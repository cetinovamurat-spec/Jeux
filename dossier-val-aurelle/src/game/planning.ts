/**
 * Planning (§10.1 steps 3-5, plan J4 §6): materiality (NEP 320), risk
 * assessment by cycle and assertion, fraud presumption by type of revenue,
 * management override, laws and regulations, risk factors captured from the
 * documents, coverage of the risks by the programme, and the check before
 * leaving the planning. Section of the game state owned by J4b: types,
 * initial value, save schema and pure actions.
 *
 * The amounts of the materiality bases are read from the balances the player
 * can see at the date (presented world), through pure functions taking the
 * balances: never from the correction key.
 */
import { z } from 'zod';
import { sumPrefixes } from '../engine/balance';
import type { IsoDate } from '../engine/dates';
import { formatEuro } from '../engine/format';
import { roundCents, type Cents } from '../engine/money';
import { buildStatements } from '../engine/statements';
import type { ChartOfAccounts, PresentationOverrides, StatementLineDef } from '../engine/types';
import type { Params } from '../scenario/params';
import type { CycleDef } from '../scenario/schemas/cycles';
import { MATERIALITY_VINTAGES, RISK_LEVELS, type MaterialityVintage, type PlanningBase, type RiskLevel } from '../scenario/schemas/planning';
import { recordGaugeEvent } from './gauges';
import type { ProgramState } from './program';
import { log, nextId, type Difficulty, type GameState } from './state';
import type { DataView } from './vintages';

export type { MaterialityVintage, RiskLevel };

export interface MaterialityChoice {
  /** Base of the materiality (params/planning.json → bases). */
  base: string;
  /** Data vintage of the base amount. */
  vintage: MaterialityVintage;
  /** Amount of the base at the time of the decision (annualised for a partial-year extraction). */
  baseAmount: Cents;
  /** Percentage applied to the base. */
  pct: number;
  /** Materiality retained (rounded by the player). */
  amount: Cents;
  planningPct: number;
  trivialPct: number;
  /** Specific threshold for the regulated agreements, in % of the materiality (optional). */
  specificPct: number | null;
  factors: string[];
  comment: string;
  on: IsoDate;
}

export interface RiskEntry {
  level: RiskLevel;
  justification: string;
  on: IsoDate;
}

/** Risk factor captured by the player from a passage of a document (block of the GED). */
export interface RiskFactor {
  id: string;
  docId: string;
  block: number | null;
  cycle: string;
  assertion: string | null;
  note: string;
  on: IsoDate;
}

export interface FraudPresumption {
  retained: boolean;
  justification: string;
  on?: IsoDate;
}

export interface PlanningState {
  /** Validated materiality choices, oldest first (the last one is in force). */
  materiality: MaterialityChoice[];
  /** Risk by 'cycle' or 'cycle:assertion' (absent cycle: moderate; absent assertion: the cycle's level). */
  risks: Record<string, RiskEntry>;
  riskFactors: RiskFactor[];
  /** Fraud presumption by type of revenue (absent: retained). */
  fraudPresumption: Record<string, FraudPresumption>;
  /** Laws and regulations retained as having an effect on the accounts (NEP 250). */
  laws: string[];
  /** Steps validated by the player (desk checklist, « Aller à l'intérim »). */
  validated: { materiality?: IsoDate; risks?: IsoDate; program?: IsoDate };
}

export function initialPlanning(): PlanningState {
  return { materiality: [], risks: {}, riskFactors: [], fraudPresumption: {}, laws: [], validated: {} };
}

const riskEntry = z.object({ level: z.enum(RISK_LEVELS), justification: z.string(), on: z.string() });
export const planningSchema = z.object({
  materiality: z.array(
    z.object({
      base: z.string(),
      vintage: z.enum(MATERIALITY_VINTAGES),
      baseAmount: z.number().int(),
      pct: z.number(),
      amount: z.number().int(),
      planningPct: z.number(),
      trivialPct: z.number(),
      specificPct: z.number().nullable(),
      factors: z.array(z.string()),
      comment: z.string(),
      on: z.string(),
    }),
  ),
  risks: z.record(z.string(), riskEntry),
  riskFactors: z.array(z.object({ id: z.string(), docId: z.string(), block: z.number().int().nullable(), cycle: z.string(), assertion: z.string().nullable(), note: z.string(), on: z.string() })),
  fraudPresumption: z.record(z.string(), z.object({ retained: z.boolean(), justification: z.string(), on: z.string().optional() })),
  laws: z.array(z.string()).default([]),
  validated: z.object({ materiality: z.string().optional(), risks: z.string().optional(), program: z.string().optional() }),
});

function withPlanning(s: GameState, planning: PlanningState): GameState {
  return { ...s, planning };
}

/** French subject of a journal event (desk journal: `data.title`), when the parameters are known. */
function titled(params: Params | undefined, f: (p: Params) => string): { title?: string } {
  return params ? { title: f(params) } : {};
}

function cycleName(params: Params, id: string): string {
  return params.cycles.cycles.find((c) => c.id === id)?.label ?? id;
}

function riskSubject(params: Params, key: string): string {
  const [cycle, assertion] = key.split(':') as [string, string | undefined];
  const a = assertion ? params.planning.assertions.find((x) => x.id === assertion)?.label ?? assertion : null;
  return a ? `${cycleName(params, cycle)} – ${a}` : cycleName(params, cycle);
}

// ---------------------------------------------------------------------------
// materiality: base amounts
// ---------------------------------------------------------------------------

/** Balances and conventions needed to compute a base amount. */
export interface BaseInput {
  /** Closing balances (debit positive). */
  balances: ReadonlyMap<string, Cents>;
  chart: ChartOfAccounts;
  statements: readonly StatementLineDef[];
  presentation: PresentationOverrides;
  year: number;
  /** Months covered by the balances: 12, or the months of an extraction during the year. */
  months: number;
}

const NO_PRESENTATION: PresentationOverrides = { reclassifications: [], annexCells: [] };

/** Amount of a materiality base from balances (flows annualised on a partial year). */
export function baseAmount(base: PlanningBase, input: BaseInput): Cents {
  let amount: Cents;
  if (base.accounts) amount = -sumPrefixes(input.balances, base.accounts.include, base.accounts.exclude ?? []);
  else {
    const st = buildStatements({ defs: input.statements, chart: input.chart, current: input.balances, prior: new Map(), currentYear: input.year, priorYear: input.year - 1, presentation: input.presentation });
    amount = st.lines[base.statementLine ?? '']?.current ?? 0;
  }
  return base.flow && input.months > 0 && input.months < 12 ? roundCents((amount * 12) / input.months) : amount;
}

/** Months covered by data at a cutoff date of the year (a month counts when its last day is reached). */
export function monthsCovered(cutoff: IsoDate): number {
  const [y, m, d] = cutoff.split('-').map(Number) as [number, number, number];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d >= last ? m : m - 1;
}

/** Data of the case the player can see, from which the vintages of the bases are derived. */
export interface VintageData {
  /** 2025 closing balances of the view (empty, extraction or final). */
  current: ReadonlyMap<string, Cents>;
  /** 2024 closing balances (certified accounts). */
  prior: ReadonlyMap<string, Cents>;
  chart: ChartOfAccounts;
  statements: readonly StatementLineDef[];
  /** Presentation of the client's 2025 accounts (reclassifications of the statements). */
  presentation: PresentationOverrides;
  view: DataView;
  currentYear: number;
}

/** Vintages available at the date, with the inputs of their base amounts (oldest first). */
export function vintageInputs(d: VintageData): Partial<Record<MaterialityVintage, BaseInput>> {
  const common = { chart: d.chart, statements: d.statements };
  const out: Partial<Record<MaterialityVintage, BaseInput>> = {
    // the certified accounts: no presentation override of the client's draft
    certified2024: { ...common, balances: d.prior, presentation: NO_PRESENTATION, year: d.currentYear - 1, months: 12 },
  };
  if (d.view.ledger2025 === 'interim') out.interim = { ...common, balances: d.current, presentation: d.presentation, year: d.currentYear, months: monthsCovered(d.view.cutoff) };
  if (d.view.ledger2025 === 'draft') out.draft2025 = { ...common, balances: d.current, presentation: d.presentation, year: d.currentYear, months: 12 };
  return out;
}

/** Latest vintage available (the default choice of the calculator). */
export function latestVintage(inputs: Partial<Record<MaterialityVintage, BaseInput>>): MaterialityVintage {
  return inputs.draft2025 ? 'draft2025' : inputs.interim ? 'interim' : 'certified2024';
}

/** Rounds an amount to the nearest multiple of a unit given in euros (0: to the euro cent, unchanged). */
export function roundToUnit(amount: Cents, unitEuros: number): Cents {
  if (unitEuros <= 0) return amount;
  const unit = unitEuros * 100;
  return Math.round(amount / unit) * unit;
}

/** Materiality from a base amount and a percentage, rounded to the unit chosen. */
export function materialityFrom(base: Cents, pct: number, unitEuros: number): Cents {
  return roundToUnit(roundCents((base * pct) / 100), unitEuros);
}

export interface Thresholds {
  materiality: Cents;
  planning: Cents;
  trivial: Cents;
  specific: Cents | null;
}

export function thresholdsOf(c: Pick<MaterialityChoice, 'amount' | 'planningPct' | 'trivialPct' | 'specificPct'>): Thresholds {
  return {
    materiality: c.amount,
    planning: roundCents((c.amount * c.planningPct) / 100),
    trivial: roundCents((c.amount * c.trivialPct) / 100),
    specific: c.specificPct === null ? null : roundCents((c.amount * c.specificPct) / 100),
  };
}

/** Materiality in force (last validated choice), or null. */
export function currentMateriality(p: PlanningState): MaterialityChoice | null {
  return p.materiality[p.materiality.length - 1] ?? null;
}

/** Planning materiality in force (default thresholds of the analytical review, sample sizes), or null. */
export function planningThreshold(p: PlanningState): Cents | null {
  const c = currentMateriality(p);
  return c ? thresholdsOf(c).planning : null;
}

export interface MaterialityFeedback {
  tone: 'ok' | 'warn' | 'ko';
  text: string;
}

const within = (v: number, [a, b]: readonly [number, number]) => v >= a - 1e-9 && v <= b + 1e-9;

/**
 * Feedback on a materiality choice (§4.7): suitability of the base and
 * percentages within the usual ranges. Generic: it never refers to the
 * misstatements of the case.
 */
export function assessMateriality(params: Params, c: Pick<MaterialityChoice, 'base' | 'pct' | 'planningPct' | 'trivialPct' | 'specificPct' | 'vintage'>): MaterialityFeedback[] {
  const p = params.planning;
  const base = p.bases.find((b) => b.id === c.base);
  const out: MaterialityFeedback[] = [];
  if (!base) return [{ tone: 'ko', text: 'Base inconnue.' }];
  out.push({ tone: base.suitability === 'recommended' ? 'ok' : base.suitability === 'acceptable' ? 'ok' : 'ko', text: base.feedback });
  const fmt = (x: number) => x.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
  if (!within(c.pct, base.pctRange)) out.push({ tone: 'warn', text: `Le pourcentage retenu (${fmt(c.pct)} %) sort de la plage usuelle pour cette base (${fmt(base.pctRange[0])} % à ${fmt(base.pctRange[1])} %).` });
  const t = p.thresholds;
  if (!within(c.planningPct, t.planningPctRange)) out.push({ tone: 'warn', text: `Le seuil de planification est usuellement fixé entre ${fmt(t.planningPctRange[0])} % et ${fmt(t.planningPctRange[1])} % du seuil de signification.` });
  if (!within(c.trivialPct, t.trivialPctRange)) out.push({ tone: 'warn', text: `Le seuil des anomalies manifestement insignifiantes est usuellement fixé entre ${fmt(t.trivialPctRange[0])} % et ${fmt(t.trivialPctRange[1])} % du seuil de signification.` });
  if (c.specificPct !== null && !within(c.specificPct, t.specificPctRange)) out.push({ tone: 'warn', text: `Un seuil spécifique se situe usuellement entre ${fmt(t.specificPctRange[0])} % et ${fmt(t.specificPctRange[1])} % du seuil de signification.` });
  if (c.vintage === 'interim' && base.flow) out.push({ tone: 'warn', text: 'Montant annualisé à partir d’une extraction en cours d’exercice : il devra être revu sur le projet de comptes.' });
  return out;
}

/** The partner reacts to a materiality outside the usual ranges, or on an unsuitable base (levels with reminders, §6.1). */
export function partnerReaction(params: Params, difficulty: Difficulty, feedback: readonly MaterialityFeedback[]): string | null {
  if (!params.game.difficulty[difficulty].reminders) return null;
  if (!feedback.some((f) => f.tone !== 'ok')) return null;
  return 'Je ne suis pas à l’aise avec ce seuil : relisez la base retenue et les pourcentages usuels, et justifiez votre choix par écrit avant de me le soumettre.';
}

/** What prevents the validation of a materiality choice (French). */
export function materialityErrors(params: Params, c: MaterialityChoice): string[] {
  const errors: string[] = [];
  if (!params.planning.bases.some((b) => b.id === c.base)) errors.push('Choisissez une base.');
  if (!(c.pct > 0)) errors.push('Le pourcentage doit être positif.');
  if (!(c.amount > 0)) errors.push('Le seuil de signification doit être positif.');
  if (!(c.planningPct > 0 && c.planningPct <= 100)) errors.push('Le seuil de planification doit être compris entre 0 et 100 % du seuil de signification.');
  if (!(c.trivialPct > 0 && c.trivialPct <= 100)) errors.push('Le seuil des anomalies insignifiantes doit être compris entre 0 et 100 % du seuil de signification.');
  if (c.specificPct !== null && !(c.specificPct > 0 && c.specificPct <= 100)) errors.push('Le seuil spécifique doit être compris entre 0 et 100 % du seuil de signification.');
  if (c.factors.length === 0 && !c.comment.trim()) errors.push('Justifiez le seuil : cochez au moins un facteur ou rédigez un commentaire.');
  return errors;
}

/** Validates a materiality choice (appended to the history; the last one is in force). */
export function validateMateriality(s: GameState, params: Params, choice: Omit<MaterialityChoice, 'on'>): GameState {
  const c: MaterialityChoice = { ...choice, factors: [...new Set(choice.factors)], comment: choice.comment.trim(), on: s.clock.date };
  if (materialityErrors(params, c).length) return s;
  const p = s.planning;
  const next = withPlanning(s, { ...p, materiality: [...p.materiality, c], validated: { ...p.validated, materiality: s.clock.date } });
  const revision = p.materiality.length > 0;
  const baseLabel = params.planning.bases.find((b) => b.id === c.base)?.label ?? c.base;
  return log(next, 'materiality', c.base, { amount: c.amount, vintage: c.vintage, revision, title: `${formatEuro(c.amount, 0)}, base : ${baseLabel}${revision ? ' (révision)' : ''}` });
}

/** The materiality must be revised on the draft accounts at the final (NEP 320): due from the start of the final until it is. */
export function materialityRevisionDue(p: PlanningState, params: Params, date: IsoDate): boolean {
  const final = params.game.calendar.find((c) => c.id === 'final');
  if (!final || date < final.from) return false;
  const c = currentMateriality(p);
  return c === null || c.vintage !== 'draft2025';
}

// ---------------------------------------------------------------------------
// accounts by cycle, significant accounts
// ---------------------------------------------------------------------------

/** Cycle of an account: the cycle whose line has the longest matching prefix (transverse when none). */
export function cycleOfAccount(account: string, cycles: readonly CycleDef[]): string {
  let best = 'crossCycle';
  let len = 0;
  for (const c of cycles)
    for (const l of c.lines) {
      if (l.exclude?.some((x) => account.startsWith(x))) continue;
      for (const p of l.include) if (account.startsWith(p) && p.length > len) [best, len] = [c.id, p.length];
    }
  return best;
}

export interface SignificantAccounts {
  cycle: string;
  /** Accounts whose balance reaches the planning materiality. */
  accounts: { account: string; balance: Cents }[];
}

/** Accounts of each cycle whose balance (absolute value) reaches the threshold, on the balances available. */
export function significantAccounts(balances: ReadonlyMap<string, Cents>, cycles: readonly CycleDef[], threshold: Cents): SignificantAccounts[] {
  const by = new Map<string, { account: string; balance: Cents }[]>(cycles.map((c) => [c.id, []]));
  for (const [account, balance] of balances) {
    if (Math.abs(balance) < threshold || balance === 0) continue;
    by.get(cycleOfAccount(account, cycles))?.push({ account, balance });
  }
  return cycles.map((c) => ({ cycle: c.id, accounts: (by.get(c.id) ?? []).sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance)) }));
}

// ---------------------------------------------------------------------------
// risks
// ---------------------------------------------------------------------------

export const DEFAULT_RISK: RiskLevel = 'moderate';
const RANK: Record<RiskLevel, number> = { low: 0, moderate: 1, high: 2, significant: 3 };

export function riskRank(level: RiskLevel): number {
  return RANK[level];
}

export function riskKey(cycle: string, assertion?: string | null): string {
  return assertion ? `${cycle}:${assertion}` : cycle;
}

/** Level of a cycle (moderate by default) or of an assertion of a cycle (the cycle's level by default). */
export function riskLevelOf(p: PlanningState, cycle: string, assertion?: string | null): RiskLevel {
  const cycleLevel = p.risks[cycle]?.level ?? DEFAULT_RISK;
  if (!assertion) return cycleLevel;
  return p.risks[riskKey(cycle, assertion)]?.level ?? cycleLevel;
}

/** Highest level of a cycle, its assertions included. */
export function maxRiskOfCycle(p: PlanningState, cycle: string): RiskLevel {
  let level = riskLevelOf(p, cycle);
  for (const [k, e] of Object.entries(p.risks)) if (k.startsWith(`${cycle}:`) && RANK[e.level] > RANK[level]) level = e.level;
  return level;
}

export function needsJustification(params: Params, level: RiskLevel): boolean {
  return params.planning.riskLevels.find((l) => l.id === level)?.needsJustification ?? false;
}

/** Sets the risk of a cycle or of an assertion (dated revision; the history is in the journal). */
export function setRisk(s: GameState, cycle: string, assertion: string | null, level: RiskLevel, justification: string, params?: Params): GameState {
  const key = riskKey(cycle, assertion);
  const p = s.planning;
  const prev = p.risks[key];
  const text = justification.trim();
  if (prev && prev.level === level && prev.justification === text) return s;
  const risks = { ...p.risks, [key]: { level, justification: text, on: s.clock.date } };
  return log(withPlanning(s, { ...p, risks }), 'risk', key, { level, ...titled(params, (x) => `${riskSubject(x, key)} : ${(x.planning.riskLevels.find((l) => l.id === level)?.label ?? level).toLowerCase()}`) });
}

/** Removes the detail of an assertion (back to the level of the cycle). */
export function clearRisk(s: GameState, key: string, params?: Params): GameState {
  if (!s.planning.risks[key]) return s;
  const risks = { ...s.planning.risks };
  delete risks[key];
  return log(withPlanning(s, { ...s.planning, risks }), 'risk', key, { cleared: true, ...titled(params, (x) => `${riskSubject(x, key)} : niveau du cycle`) });
}

export function setFraudPresumption(s: GameState, revenueType: string, retained: boolean, justification: string, params?: Params): GameState {
  const p = s.planning;
  const entry: FraudPresumption = { retained, justification: justification.trim(), on: s.clock.date };
  const prev = p.fraudPresumption[revenueType];
  if (prev && prev.retained === entry.retained && prev.justification === entry.justification) return s;
  const label = (x: Params) => x.planning.revenueTypes.find((r) => r.id === revenueType)?.label ?? revenueType;
  return log(withPlanning(s, { ...p, fraudPresumption: { ...p.fraudPresumption, [revenueType]: entry } }), 'risk', `fraud:${revenueType}`, {
    action: 'fraudPresumption',
    retained,
    ...titled(params, (x) => `présomption de fraude sur « ${label(x)} » ${retained ? 'retenue' : 'réfutée'}`),
  });
}

/** The presumption of fraud is retained unless the player rebuts it. */
export function fraudRetained(p: PlanningState, revenueType: string): boolean {
  return p.fraudPresumption[revenueType]?.retained ?? true;
}

export function toggleLaw(s: GameState, id: string, params?: Params): GameState {
  const p = s.planning;
  const laws = p.laws.includes(id) ? p.laws.filter((x) => x !== id) : [...p.laws, id];
  const retained = laws.includes(id);
  const label = (x: Params) => x.planning.lawsRegulations.find((l) => l.id === id)?.label ?? id;
  return log(withPlanning(s, { ...p, laws }), 'risk', `laws:${id}`, { action: 'laws', retained, ...titled(params, (x) => `textes « ${label(x)} » ${retained ? 'retenus' : 'retirés'}`) });
}

/** Adds a risk factor captured from a document passage (id given by the caller, from the state counter). */
export function addRiskFactor(p: PlanningState, f: RiskFactor): PlanningState {
  return { ...p, riskFactors: [...p.riskFactors, f] };
}

export function removeRiskFactor(p: PlanningState, id: string): PlanningState {
  return { ...p, riskFactors: p.riskFactors.filter((f) => f.id !== id) };
}

/** « Marquer comme facteur de risque » on a document (or one of its blocks), with a cycle and an optional assertion. */
export function captureRiskFactor(s: GameState, f: Omit<RiskFactor, 'id' | 'on'>, params?: Params): GameState {
  if (!f.docId || !f.cycle) return s;
  const [id, s1] = nextId(s, 'rf');
  const factor: RiskFactor = { ...f, note: f.note.trim(), id, on: s1.clock.date };
  return log(withPlanning(s1, addRiskFactor(s1.planning, factor)), 'risk', f.docId, {
    action: 'riskFactor',
    cycle: f.cycle,
    ...(f.block !== null ? { block: f.block } : {}),
    ...titled(params, (x) => `facteur de risque relevé dans une pièce (${riskSubject(x, f.assertion ? `${f.cycle}:${f.assertion}` : f.cycle)})`),
  });
}

export function deleteRiskFactor(s: GameState, id: string): GameState {
  return withPlanning(s, removeRiskFactor(s.planning, id));
}

/** What prevents the validation of the risk assessment (French). */
export function riskErrors(params: Params, p: PlanningState): string[] {
  const errors: string[] = [];
  const cycleLabel = (id: string) => params.cycles.cycles.find((c) => c.id === id)?.label ?? id;
  const assertionLabel = (id: string) => params.planning.assertions.find((a) => a.id === id)?.label ?? id;
  for (const [key, e] of Object.entries(p.risks)) {
    if (needsJustification(params, e.level) && !e.justification.trim()) {
      const [cycle, assertion] = key.split(':') as [string, string | undefined];
      errors.push(`Justifiez le niveau de risque de « ${cycleLabel(cycle)}${assertion ? ` – ${assertionLabel(assertion)}` : ''} ».`);
    }
  }
  for (const r of params.planning.revenueTypes) {
    const f = p.fraudPresumption[r.id];
    if (f && !f.retained && !f.justification.trim()) errors.push(`Justifiez la réfutation de la présomption de fraude sur « ${r.label} ».`);
  }
  return errors;
}

/**
 * Validates the risk assessment. The risk of management override is always
 * retained: its mandatory responses are added to the programme.
 */
export function validateRisks(s: GameState, params: Params): GameState {
  if (riskErrors(params, s.planning).length) return s;
  const program = ensureOverrideResponses(s.program, params);
  const next: GameState = { ...s, program, planning: { ...s.planning, validated: { ...s.planning.validated, risks: s.clock.date } } };
  return log(next, 'risk', 'validated', { action: 'validate', title: 'évaluation des risques validée' });
}

/** Adds the responses to management override missing from the programme (assigned to the senior when possible). */
export function ensureOverrideResponses(program: ProgramState, params: Params): ProgramState {
  const planned = new Set(program.planned.map((x) => x.procedureId));
  const added = params.planning.overrideResponses
    .filter((id) => !planned.has(id))
    .flatMap((id) => {
      const def = params.procedures.procedures.find((p) => p.id === id);
      if (!def) return [];
      const profiles = params.procedures.profiles;
      const members = (['senior', 'lea', 'hugo', 'sofia'] as const).filter((m) => def.hours[profiles[m]] !== undefined);
      const assignee = members[0];
      return assignee ? [{ procedureId: id, assignee }] : [];
    });
  return added.length ? { ...program, planned: [...program.planned, ...added] } : program;
}

// ---------------------------------------------------------------------------
// coverage of the risks by the programme
// ---------------------------------------------------------------------------

export interface CoverageRow {
  key: string;
  kind: 'cycle' | 'assertion' | 'fraud' | 'override' | 'laws';
  label: string;
  level?: RiskLevel;
  /** A response is expected (risk assessed high or significant, fraud presumption retained, override, law retained). */
  required: boolean;
  /** Planned procedures answering the risk. */
  procedures: string[];
  covered: boolean;
}

/** Risk → procedures view (plan J4 §6.2): what the programme answers, and the risks left without a response. */
export function coverage(p: PlanningState, program: ProgramState, params: Params): CoverageRow[] {
  const defs = new Map(params.procedures.procedures.map((d) => [d.id, d]));
  const planned = program.planned.map((x) => defs.get(x.procedureId)).filter((d): d is NonNullable<typeof d> => d !== undefined);
  const answering = (match: (r: string) => boolean) => planned.filter((d) => d.risksAddressed.some(match)).map((d) => d.id);
  const rows: CoverageRow[] = [];
  const assertionLabel = (id: string) => params.planning.assertions.find((a) => a.id === id)?.label ?? id;
  for (const c of params.cycles.cycles) {
    const level = riskLevelOf(p, c.id);
    const procs = answering((r) => r === c.id || r.startsWith(`${c.id}:`));
    const required = RANK[level] >= RANK.high;
    rows.push({ key: c.id, kind: 'cycle', label: c.label, level, required, procedures: procs, covered: procs.length > 0 });
    for (const [key, e] of Object.entries(p.risks)) {
      if (!key.startsWith(`${c.id}:`)) continue;
      const assertion = key.slice(c.id.length + 1);
      const ap = answering((r) => r === key);
      rows.push({ key, kind: 'assertion', label: `${c.label} – ${assertionLabel(assertion)}`, level: e.level, required: RANK[e.level] >= RANK.high, procedures: ap, covered: ap.length > 0 });
    }
  }
  for (const r of params.planning.revenueTypes) {
    if (!fraudRetained(p, r.id)) continue;
    const procs = answering((x) => x === `fraud:${r.id}`);
    rows.push({ key: `fraud:${r.id}`, kind: 'fraud', label: `Présomption de fraude – ${r.label}`, required: true, procedures: procs, covered: procs.length > 0 });
  }
  const plannedIds = new Set(program.planned.map((x) => x.procedureId));
  const override = params.planning.overrideResponses;
  rows.push({ key: 'override', kind: 'override', label: 'Contournement des contrôles par la direction (toujours retenu)', required: true, procedures: override.filter((id) => plannedIds.has(id)), covered: override.every((id) => plannedIds.has(id)) });
  for (const id of p.laws) {
    const law = params.planning.lawsRegulations.find((l) => l.id === id);
    if (!law) continue;
    const procs = answering((x) => x === `laws:${id}`);
    rows.push({ key: `laws:${id}`, kind: 'laws', label: `Textes – ${law.label}`, required: true, procedures: procs, covered: procs.length > 0 });
  }
  return rows;
}

/** Risks expecting a response and left uncovered by the programme. */
export function uncoveredRisks(p: PlanningState, program: ProgramState, params: Params): CoverageRow[] {
  return coverage(p, program, params).filter((r) => r.required && !r.covered);
}

// ---------------------------------------------------------------------------
// leaving the planning
// ---------------------------------------------------------------------------

export type PlanningStep = 'materiality' | 'risks' | 'program';

export const PLANNING_STEPS: readonly { step: PlanningStep; label: string }[] = [
  { step: 'materiality', label: 'Seuils de signification' },
  { step: 'risks', label: 'Évaluation des risques' },
  { step: 'program', label: 'Programme de travail' },
];

/** Steps of the planning not yet validated. */
export function planningWarnings(p: PlanningState): { step: PlanningStep; label: string }[] {
  return PLANNING_STEPS.filter((x) => !p.validated[x.step]);
}

export const INTERIM_WITHOUT_PLANNING = 'interimWithoutPlanning';

export interface LeavePlanningCheck {
  /** Steps not validated. */
  missing: { step: PlanningStep; label: string }[];
  /** The partner's loss of trust was already recorded (the warning is shown again, without a new event). */
  alreadyRecorded: boolean;
}

/**
 * Check before leaving the planning (plan J4 §3): moving the clock from
 * before the interim to the interim or later without validated materiality,
 * risks and programme costs the partner's trust. Null when the move does not
 * leave the planning or when everything is validated.
 */
export function leavePlanningCheck(s: GameState, params: Params, target: IsoDate): LeavePlanningCheck | null {
  const interim = params.game.calendar.find((c) => c.id === 'interim');
  if (!interim || s.clock.date >= interim.from || target < interim.from) return null;
  const missing = planningWarnings(s.planning);
  if (missing.length === 0) return null;
  return { missing, alreadyRecorded: s.gauges.events.some((e) => e.reason === INTERIM_WITHOUT_PLANNING) };
}

/** Records the gauge event of an interim started without a validated planning (once). */
export function recordInterimWithoutPlanning(s: GameState): GameState {
  if (s.gauges.events.some((e) => e.reason === INTERIM_WITHOUT_PLANNING)) return s;
  const missing = planningWarnings(s.planning).map((m) => m.step);
  const gauges = recordGaugeEvent(s.gauges, { on: s.clock.date, gauge: 'partnerTrust', reason: INTERIM_WITHOUT_PLANNING, ref: missing.join(',') });
  return log({ ...s, gauges }, 'gaugeEvent', INTERIM_WITHOUT_PLANNING, { missing: missing.join(','), title: 'intérim commencé sans planification validée' });
}
