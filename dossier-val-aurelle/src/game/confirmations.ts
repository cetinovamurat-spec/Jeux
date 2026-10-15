/**
 * External confirmations (plan J4 §9): third parties selected at the interim,
 * sent automatically on the sending date, reminders; replies are derived from
 * the date. Section of the game state owned by J4c.
 */
import { z } from 'zod';
import type { HoursCharge } from './budget';
import type { IsoDate } from '../engine/dates';
import type { Params } from '../scenario/params';
import type { UpcomingContext, UpcomingEvent } from './advance';

export interface ConfirmationItem {
  /** Third party (id of the confirmation populations). */
  thirdParty: string;
  preparedOn: IsoDate;
  remindedOn?: IsoDate;
}

export interface ConfirmationsState {
  items: ConfirmationItem[];
}

export function initialConfirmations(): ConfirmationsState {
  return { items: [] };
}

export const confirmationsSchema = z.object({
  items: z.array(z.object({ thirdParty: z.string(), preparedOn: z.string(), remindedOn: z.string().optional() })),
});

/** Confirmation requests sent at the date (keys of the documents' `confirmation` availability). J4c implements it. */
export function sentConfirmations(_s: ConfirmationsState, _params: Params, _date: IsoDate): ReadonlySet<string> {
  return new Set();
}

/** Upcoming events of the confirmations (sending, expected replies). J4c implements it. */
export function upcomingConfirmations(_s: ConfirmationsState, _ctx: UpcomingContext): UpcomingEvent[] {
  return [];
}

/** Hours charged to the budget by the preparation and follow-up of the confirmations. */
export function hoursCharged(_s: ConfirmationsState, _params: Params): HoursCharge[] {
  return [];
}
