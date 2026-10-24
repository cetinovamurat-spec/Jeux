/**
 * Hooks shared by the screens: availability of documents, game state
 * shortcuts and the narrow selectors of the derived values (hours, gauges,
 * messages), recomputed only when the sections they read change.
 */
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { HOURS_SECTIONS, hoursUsed, type HoursUsed } from '../../game/budget';
import { workCalendar, type WorkCalendar } from '../../game/calendar';
import { availabilityContext, isAvailable, type AvailabilityContext } from '../../game/documents';
import { GAUGE_SECTIONS, gaugeReport, gaugeRules, type GaugeReport, type GaugeValues } from '../../game/gauge-values';
import { inbox, unreadCount, type Message, type MessageContext } from '../../game/messages';
import type { GameState } from '../../game/state';
import type { DocumentModel } from '../../scenario/documents';
import { useCase } from './context';
import { useGame } from './store';

export function useAvailability(): AvailabilityContext {
  const c = useCase();
  const clock = useGame((s) => s.game.clock);
  const settings = useGame((s) => s.game.settings);
  const requests = useGame((s) => s.game.requests);
  const confirmations = useGame((s) => s.game.confirmations);
  return useMemo(() => availabilityContext({ clock, settings, requests, confirmations }, c.params), [c, clock, settings, requests, confirmations]);
}

/** Documents the player can consult at the current game date (all of them in designer mode). */
export function useAvailableDocuments(): DocumentModel[] {
  const c = useCase();
  const ctx = useAvailability();
  return useMemo(() => c.documents.filter((d) => isAvailable(d, ctx)), [c, ctx]);
}

export function useDesigner(): boolean {
  return useGame((s) => s.game.settings.designer);
}

/** The listed sections of the game state, as one object that keeps its identity while they do not change (with useShallow). */
function pick<K extends keyof GameState>(s: GameState, keys: readonly K[]): Pick<GameState, K> {
  const out = {} as Pick<GameState, K>;
  for (const k of keys) out[k] = s[k];
  return out;
}

/**
 * Last result of a derivation, shared by every component that reads it: it
 * is recomputed only when one of its inputs (section references, date,
 * parameters) changes.
 */
function shared<T>(): (inputs: readonly unknown[], compute: () => T) => T {
  let last: { inputs: readonly unknown[]; value: T } | null = null;
  return (inputs, compute) => {
    if (last && last.inputs.length === inputs.length && last.inputs.every((x, i) => Object.is(x, inputs[i]))) return last.value;
    const value = compute();
    last = { inputs, value };
    return value;
  };
}

const sharedHours = shared<HoursUsed>();
const sharedGauges = shared<GaugeReport>();

/** Working calendar of the game (stable for the case). */
export function useWorkCalendar(): WorkCalendar {
  const c = useCase();
  return useMemo(() => workCalendar(c.params), [c]);
}

/** Hours charged to the budget, by member (every provider of game/budget.ts). */
export function useHoursUsed(): HoursUsed {
  const c = useCase();
  const host = useGame(useShallow((s) => pick(s.game, HOURS_SECTIONS)));
  return useMemo(() => sharedHours([...HOURS_SECTIONS.map((k) => host[k]), c.params], () => hoursUsed(host, c.params)), [host, c]);
}

/** Values of the gauges at the game date and their variations (game/gauge-values.ts). */
export function useGaugeReport(): GaugeReport {
  const c = useCase();
  const cal = useWorkCalendar();
  const host = useGame(useShallow((s) => pick(s.game, GAUGE_SECTIONS)));
  const date = useGame((s) => s.game.clock.date);
  const rules = useMemo(() => gaugeRules(c.params), [c]);
  return useMemo(() => sharedGauges([...GAUGE_SECTIONS.map((k) => host[k]), c.params, date], () => gaugeReport(host, c.params, date, cal, rules)), [host, c, date, cal, rules]);
}

export function useGaugeValues(): GaugeValues {
  return useGaugeReport().values;
}

/** The client relation is below its low threshold at the game date (passed to the requests sent: delays fixed at the sending). */
export function useRelationLow(): boolean {
  const c = useCase();
  const value = useGaugeReport().values.clientRelation;
  return value < c.params.game.gauges.clientRelation.lowThreshold;
}

/** Context of the mailbox at the game date. */
export function useMessageContext(): MessageContext {
  const c = useCase();
  const cal = useWorkCalendar();
  const date = useGame((s) => s.game.clock.date);
  return useMemo(() => ({ params: c.params, cal, date }), [c, cal, date]);
}

/** Messages received at the game date, most recent first. */
export function useInbox(): Message[] {
  const ctx = useMessageContext();
  const game = useGame((s) => s.game);
  return useMemo(() => inbox(game, ctx), [game, ctx]);
}

/** Number of unread messages at the game date. */
export function useUnreadCount(): number {
  const c = useCase();
  const cal = useWorkCalendar();
  return useGame((s) => unreadCount(s.game, { params: c.params, cal, date: s.game.clock.date }));
}
