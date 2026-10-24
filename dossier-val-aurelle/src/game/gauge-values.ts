/**
 * Values of the gauges (plan J5 §10.1, J5-17): starting value plus the
 * effects of the gauge events, derived at a date, never stored.
 *
 * 1. Events: those J4 stores (`state.gauges.events`) and those of the
 *    providers of the registry `GAUGE_PROVIDERS` (interviews, ethics,
 *    escalations, review), each dated and numbered (`seq`).
 * 2. Order: (date, `seq`, rank of the provider). The rules « N at most » or
 *    « free up to N » (`GaugeRules.repeat`) are evaluated in this order.
 * 3. Effect: delta (scale of the effects, or the delta the provider fixed) ×
 *    multipliers (sensitivity given by the provider; loss factor of the
 *    client relation by level), rounded once to an integer (half away from
 *    zero), then the value is bounded between 0 and 100.
 * 4. Recovery of the client relation towards its target after a number of
 *    working days without a negative event, computed by differences of
 *    working days (no walk day by day).
 *
 * `gauges.ts` stays a leaf module (types, schema, recordGaugeEvent).
 */
import { addDays, maxDate, weekday, type IsoDate } from '../engine/dates';
import type { Params } from '../scenario/params';
import type { GaugeId } from '../scenario/schemas/gauge-codes';
import { addWorkingDays, workCalendar, workingDayOnOrAfter, workingDaysBetween, type WorkCalendar } from './calendar';
import { engagementPhaseAt } from './clock';
import { escalationGaugeEvents } from './escalations';
import { ethicsGaugeEvents } from './ethics';
import { interviewGaugeEvents } from './interviews';
import { reviewGaugeEvents } from './review';
import type { Difficulty, GameState } from './state';

// ---------------------------------------------------------------------------
// rules (scale of the effects, repetitions, multipliers, recovery)
// ---------------------------------------------------------------------------

export interface GaugeEffect {
  /** Delta before the multipliers (points out of 100). */
  delta: number;
  /** Generic label shown with the last variations (never a lead). */
  label: string;
}

/** Scale of the effects by reason code. A code absent from the scale has no effect unless its provider fixes the delta. */
export type GaugeEffects = Readonly<Partial<Record<string, GaugeEffect>>>;

/** Repetition rule of a code: the first `free` events of the scope have no effect; beyond `max`, none either. */
export interface RepeatRule {
  free?: number;
  max?: number;
  per: 'phase' | 'week' | 'engagement';
}

export interface GaugeRules {
  initial: Readonly<Record<GaugeId, number>>;
  /** Low thresholds (strictly below: the gauge is low). */
  lowThreshold: Readonly<Record<GaugeId, number>>;
  effects: GaugeEffects;
  repeat: Readonly<Partial<Record<string, RepeatRule>>>;
  /** Multiplier of the losses of the client relation, by level (§13: indulgent relation at the assistant level). */
  clientRelationLossFactor: Readonly<Record<Difficulty, number>>;
  /** Recovery of the client relation (J5-18), null when it does not recover. */
  recovery: { target: number; afterDays: number; perDay: number } | null;
  /** Effects of a low client relation (J5-18): delays of the requests, spacing of the sessions. */
  lowRelation: { delayFactor: number; gapExtraDays: number };
}

/** Effects of the events recorded by J4 (§10.2). */
export const J4_GAUGE_EFFECTS: GaugeEffects = {
  duplicateRequest: { delta: -2, label: 'Demande en double' },
  unrelatedRequest: { delta: -1, label: 'Demande sur un cycle sans risque relevé' },
  interimWithoutPlanning: { delta: -10, label: 'Intérim commencé sans planification validée' },
  unjustifiedOverrun: { delta: -8, label: 'Dépassement du budget non justifié' },
  aidUsed: { delta: -3, label: 'Conseil de méthode demandé au manager' },
  relationRecovery: { delta: 1, label: 'Relation apaisée' },
};

/** Rules of the gauges besides the starting values and the thresholds of params/game.json (plan J5 §10, §13, J5-18). */
export const DEFAULT_GAUGE_RULES: Omit<GaugeRules, 'initial' | 'lowThreshold'> = {
  effects: J4_GAUGE_EFFECTS,
  repeat: { unrelatedRequest: { free: 3, per: 'phase' } },
  clientRelationLossFactor: { assistant: 0.5, senior: 1, manager: 1 },
  recovery: { target: 50, afterDays: 10, perDay: 1 },
  lowRelation: { delayFactor: 1.5, gapExtraDays: 2 },
};

/** Rules of the gauges of a game: starting values and thresholds from params/game.json, the rest from `base`. */
export function gaugeRules(params: Params, base: Omit<GaugeRules, 'initial' | 'lowThreshold'> = DEFAULT_GAUGE_RULES): GaugeRules {
  const g = params.game.gauges;
  return {
    ...base,
    initial: { clientRelation: g.clientRelation.initial, partnerTrust: g.partnerTrust.initial, karimTrust: g.karimTrust.initial },
    lowThreshold: { clientRelation: g.clientRelation.lowThreshold, partnerTrust: g.partnerTrust.lowThreshold, karimTrust: g.karimTrust.lowThreshold },
  };
}

// ---------------------------------------------------------------------------
// providers
// ---------------------------------------------------------------------------

/** Sections of the game state the providers read (the UI selects them, so that the gauges are recomputed only when they change). */
export const GAUGE_SECTIONS = ['difficulty', 'gauges', 'planning', 'program', 'requests', 'findings', 'interviews', 'ethics'] as const satisfies readonly (keyof GameState)[];
export type GaugeSection = (typeof GAUGE_SECTIONS)[number];
export type GaugeHost = Pick<GameState, GaugeSection>;

export interface GaugeContext {
  params: Params;
  cal: WorkCalendar;
}

/** Gauge event derived by a provider from the stored actions (fixed at the action: its inputs never change afterwards). */
export interface ProvidedGaugeEvent {
  on: IsoDate;
  /** Number of the action the event comes from. */
  seq: number;
  gauge: GaugeId;
  reason: string;
  ref?: string;
  /** Delta fixed by the provider (replaces the scale; e.g. the decreasing yields of the one-to-one sessions). */
  delta?: number;
  /** Multiplier of the delta (sensitivity of the person). */
  factor?: number;
}

export interface GaugeEventProvider {
  id: string;
  events: (s: GaugeHost, ctx: GaugeContext) => readonly ProvidedGaugeEvent[];
}

/** Events recorded by J4 (requests, planning, budget, aid); those of the saves of J4 were numbered at the migration. */
function storedEvents(s: GaugeHost): ProvidedGaugeEvent[] {
  return s.gauges.events.map((e) => ({ on: e.on, seq: e.seq ?? 0, gauge: e.gauge, reason: e.reason, ...(e.ref !== undefined ? { ref: e.ref } : {}) }));
}

/** Providers of the gauge events, in rank order (order of the events of a same day and number). */
export const GAUGE_PROVIDERS: readonly GaugeEventProvider[] = [
  { id: 'stored', events: (s) => storedEvents(s) },
  { id: 'interviews', events: (s, ctx) => interviewGaugeEvents(s, ctx) },
  { id: 'ethics', events: (s, ctx) => ethicsGaugeEvents(s, ctx) },
  { id: 'escalations', events: (s, ctx) => escalationGaugeEvents(s, ctx) },
  { id: 'review', events: (s, ctx) => reviewGaugeEvents(s, ctx) },
];

// ---------------------------------------------------------------------------
// values
// ---------------------------------------------------------------------------

export interface GaugeHistoryEntry {
  on: IsoDate;
  seq: number;
  gauge: GaugeId;
  reason: string;
  ref?: string;
  label: string;
  /** Effect after the multipliers, rounded (before the bounds). */
  effect: number;
  /** Change of the value (after the bounds). */
  delta: number;
  /** Value after the event. */
  value: number;
}

export type GaugeValues = Record<GaugeId, number>;

/** Rounding to an integer, half away from zero. */
export function roundEffect(x: number): number {
  const r = Math.round(Math.abs(x) + 1e-9);
  return x < 0 ? -r : r;
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}

/** Monday of the week of a date (scope of a weekly repetition rule). */
function weekOf(date: IsoDate): IsoDate {
  return addDays(date, -((weekday(date) + 6) % 7));
}

function scopeKey(rule: RepeatRule, params: Params, date: IsoDate): string {
  switch (rule.per) {
    case 'phase':
      return engagementPhaseAt(params.game.calendar, date);
    case 'week':
      return weekOf(date);
    default:
      return '';
  }
}

export interface GaugeReport {
  /** Variations in order (events with an effect, recoveries of the client relation). */
  history: GaugeHistoryEntry[];
  values: GaugeValues;
}

/** A provided event with the rank of its provider and its position in the provider's list. */
export interface RankedGaugeEvent {
  e: ProvidedGaugeEvent;
  rank: number;
  index: number;
}

/** Order of the gauge events: date, number of the action, rank of the provider, position. */
export function compareGaugeEvents(a: RankedGaugeEvent, b: RankedGaugeEvent): number {
  if (a.e.on !== b.e.on) return a.e.on < b.e.on ? -1 : 1;
  return a.e.seq - b.e.seq || a.rank - b.rank || a.index - b.index;
}

/** Every event of the providers at or before the date, in order. */
function orderedEvents(s: GaugeHost, ctx: GaugeContext, date: IsoDate | undefined): RankedGaugeEvent[] {
  const out: RankedGaugeEvent[] = [];
  GAUGE_PROVIDERS.forEach((p, rank) =>
    p.events(s, ctx).forEach((e, index) => {
      if (date === undefined || e.on <= date) out.push({ e, rank, index });
    }),
  );
  return out.sort(compareGaugeEvents);
}

function compute(s: GaugeHost, params: Params, date: IsoDate | undefined, cal: WorkCalendar, rules: GaugeRules): GaugeReport {
  const values: GaugeValues = { ...rules.initial };
  const history: GaugeHistoryEntry[] = [];
  const counters = new Map<string, number>();
  const recovery = rules.recovery;
  // recovery of the client relation: last negative event, last date the recovery was computed up to
  let lastNegative: IsoDate = params.game.startDate;
  let recoveredTo: IsoDate = params.game.startDate;
  const recoveryLabel = rules.effects['relationRecovery']?.label ?? 'Relation apaisée';

  /** Recovery of the client relation over (recoveredTo, to]. */
  const recover = (to: IsoDate) => {
    if (!recovery || to <= recoveredTo) return;
    const from = recoveredTo;
    recoveredTo = to;
    const v = values.clientRelation;
    if (v >= recovery.target || recovery.perDay <= 0) return;
    // first day of recovery: after `afterDays` working days without a negative event
    const start = addWorkingDays(cal, lastNegative, recovery.afterDays + 1);
    if (start > to) return;
    const days = workingDaysBetween(cal, maxDate(from, addDays(start, -1)), to);
    if (days <= 0) return;
    const needed = Math.ceil((recovery.target - v) / recovery.perDay);
    const n = Math.min(days, needed);
    const gain = Math.min(n * recovery.perDay, recovery.target - v);
    const first = workingDayOnOrAfter(cal, maxDate(addDays(from, 1), start));
    const on = addWorkingDays(cal, first, n - 1);
    values.clientRelation = v + gain;
    history.push({ on, seq: 0, gauge: 'clientRelation', reason: 'relationRecovery', label: recoveryLabel, effect: gain, delta: gain, value: values.clientRelation });
  };

  for (const { e } of orderedEvents(s, { params, cal }, date)) {
    if (e.gauge === 'clientRelation') recover(e.on);
    const effect = rules.effects[e.reason];
    let raw = e.delta ?? effect?.delta ?? 0;
    const rule = rules.repeat[e.reason];
    if (rule) {
      const key = `${e.reason}|${scopeKey(rule, params, e.on)}`;
      const count = counters.get(key) ?? 0;
      counters.set(key, count + 1);
      if ((rule.free !== undefined && count < rule.free) || (rule.max !== undefined && count >= rule.max)) raw = 0;
    }
    const loss = e.gauge === 'clientRelation' && raw < 0 ? (rules.clientRelationLossFactor[s.difficulty] ?? 1) : 1;
    const rounded = roundEffect(raw * (e.factor ?? 1) * loss);
    if (rounded === 0) continue;
    const before = values[e.gauge];
    const after = clamp(before + rounded);
    values[e.gauge] = after;
    if (e.gauge === 'clientRelation' && rounded < 0) {
      lastNegative = e.on;
      recoveredTo = maxDate(recoveredTo, e.on);
    }
    history.push({ on: e.on, seq: e.seq, gauge: e.gauge, reason: e.reason, ...(e.ref !== undefined ? { ref: e.ref } : {}), label: effect?.label ?? 'Variation', effect: rounded, delta: after - before, value: after });
  }
  if (date !== undefined) recover(date);
  return { history, values };
}

/** Values of the gauges at the date and their variations up to it, computed once. */
export function gaugeReport(s: GaugeHost, params: Params, date: IsoDate, cal: WorkCalendar = workCalendar(params), rules: GaugeRules = gaugeRules(params)): GaugeReport {
  return compute(s, params, date, cal, rules);
}

/**
 * Variations of the gauges up to the date (every event with an effect, and
 * the recoveries of the client relation), in order; all of them when the
 * date is absent (without the recovery after the last event).
 */
export function gaugeHistory(s: GaugeHost, params: Params, date?: IsoDate, cal: WorkCalendar = workCalendar(params), rules: GaugeRules = gaugeRules(params)): GaugeHistoryEntry[] {
  return compute(s, params, date, cal, rules).history;
}

/** Values of the gauges at the date. */
export function gaugeValues(s: GaugeHost, params: Params, date: IsoDate, cal: WorkCalendar = workCalendar(params), rules: GaugeRules = gaugeRules(params)): GaugeValues {
  return compute(s, params, date, cal, rules).values;
}

/** The client relation is below its low threshold at the date (read by the caller of sendRequest and of the questions). */
export function relationLow(s: GaugeHost, params: Params, date: IsoDate, cal: WorkCalendar = workCalendar(params), rules: GaugeRules = gaugeRules(params)): boolean {
  return gaugeValues(s, params, date, cal, rules).clientRelation < rules.lowThreshold.clientRelation;
}
