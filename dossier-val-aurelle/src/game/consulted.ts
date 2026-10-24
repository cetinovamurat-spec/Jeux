/**
 * Data consulted (plan J5 J5-26): the first opening of an account in the
 * general ledger and of an entry in the FEC, dated. The interviews unlock
 * the questions on what the player actually looked at (§5.2). Section of the
 * game state: types, initial value, save schema, action.
 */
import { z } from 'zod';
import type { IsoDate } from '../engine/dates';
import type { GameState } from './state';

/** Date of the first opening, by key ('acct:4687', 'fec:2025:OD000189'). */
export type ConsultedState = Record<string, IsoDate>;

export function initialConsulted(): ConsultedState {
  return {};
}

export const consultedSchema = z.record(z.string(), z.string());

/** Key of an account opened in the general ledger (whatever the year). */
export function accountConsultedKey(account: string): string {
  return `acct:${account}`;
}

/** Key of an entry opened in the FEC: year and FEC number (never the internal id). */
export function fecEntryConsultedKey(year: number, num: string): string {
  return `fec:${year}:${num}`;
}

/** Records the first opening at the game date; the same state when the key is already noted. */
export function markConsulted(s: GameState, key: string): GameState {
  if (!key || s.consulted[key] !== undefined) return s;
  return { ...s, consulted: { ...s.consulted, [key]: s.clock.date } };
}

/** Date of the first opening at or before the date, if any (a clock moved back hides what was opened later). */
export function consultedOn(s: Pick<GameState, 'consulted'>, key: string, date?: IsoDate): IsoDate | undefined {
  const on = s.consulted[key];
  return on !== undefined && (date === undefined || on <= date) ? on : undefined;
}
