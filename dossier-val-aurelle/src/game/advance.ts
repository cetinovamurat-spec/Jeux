/**
 * Time in the game (plan J4 §5): the date moves forward by explicit actions
 * (next working day, next event); everything that arrives is derived from
 * the date, so moving the clock (even backwards, in designer mode) never
 * leaves the state inconsistent. Pure.
 */
import { formatDateFr, type IsoDate } from '../engine/dates';
import type { Params } from '../scenario/params';
import { nextWorkingDay, type WorkCalendar } from './calendar';
import { upcomingConfirmations } from './confirmations';
import { upcomingProgram } from './program';
import { upcomingRequests } from './requests';
import { log, type GameState } from './state';
import { vintageDates } from './vintages';

export interface UpcomingEvent {
  date: IsoDate;
  kind: 'period' | 'data' | 'delivery' | 'answer' | 'confirmation' | 'deadline';
  label: string;
  /** Screen concerned (react-router path). */
  to?: string;
}

export interface UpcomingContext {
  params: Params;
  cal: WorkCalendar;
  /** Current game date: only events strictly after it are upcoming. */
  date: IsoDate;
}

/** Events known to the player after the game date, in date order: calendar, data vintages and the sections' events. */
export function upcomingEvents(s: GameState, ctx: UpcomingContext): UpcomingEvent[] {
  const out: UpcomingEvent[] = [];
  for (const p of ctx.params.game.calendar) out.push({ date: p.from, kind: 'period', label: p.label });
  const v = vintageDates(ctx.params);
  out.push({ date: v.interimDelivered, kind: 'data', label: `Remise de l’extraction comptable au ${formatDateFr(v.cutoff)} (à défaut de demande préalable)`, to: '/balance' });
  out.push({ date: v.draftLedger, kind: 'data', label: 'Balance et FEC définitifs 2025', to: '/balance' });
  out.push({ date: v.draftStatements, kind: 'data', label: 'Projet d’états financiers et d’annexe 2025', to: '/etats' });
  out.push(...upcomingProgram(s.program, ctx), ...upcomingRequests(s.requests, ctx), ...upcomingConfirmations(s.confirmations, ctx));
  return out.filter((e) => e.date > ctx.date).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Moves the clock to a date (forward, or backward in designer mode); dated effects are applied up to it. */
export function advanceTo(s: GameState, date: IsoDate): GameState {
  if (date === s.clock.date) return s;
  const moved: GameState = { ...s, clock: { date, processedUntil: date > s.clock.processedUntil ? date : s.clock.processedUntil } };
  return log(moved, 'clock', date, { title: formatDateFr(date) });
}

/** Next working day. */
export function advanceOneDay(s: GameState, cal: WorkCalendar): GameState {
  return advanceTo(s, nextWorkingDay(cal, s.clock.date));
}

/** Date of the next upcoming event, or the next working day when nothing is expected. */
export function nextEventDate(s: GameState, ctx: UpcomingContext): IsoDate {
  return upcomingEvents(s, ctx)[0]?.date ?? nextWorkingDay(ctx.cal, s.clock.date);
}
