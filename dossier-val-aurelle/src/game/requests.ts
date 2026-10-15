/**
 * Document requests (plan J4 §8): parametric requests (family × object) sent
 * to an interlocutor, reminders; answers are derived from the date. Section
 * of the game state owned by J4c.
 */
import { z } from 'zod';
import type { IsoDate } from '../engine/dates';
import type { Params } from '../scenario/params';
import type { UpcomingContext, UpcomingEvent } from './advance';

export interface RequestItem {
  id: string;
  /** Request family (params/requests.json). */
  family: string;
  /** Object of the request (programme, third party, FEC entry number, month…), '' when the family has none. */
  object: string;
  sentOn: IsoDate;
  remindedOn?: IsoDate;
}

export interface RequestsState {
  items: RequestItem[];
}

export function initialRequests(): RequestsState {
  return { items: [] };
}

export const requestsSchema = z.object({
  items: z.array(z.object({ id: z.string(), family: z.string(), object: z.string(), sentOn: z.string(), remindedOn: z.string().optional() })),
});

/**
 * Keys of the requests answered at the date (`family` or `family:object`),
 * read by the document availability and the data vintages. J4c computes the
 * answer dates (interlocutor delays, documents not yet established).
 */
export function answeredRequests(_s: RequestsState, _params: Params, _date: IsoDate): ReadonlySet<string> {
  return new Set();
}

/** Upcoming events of the requests (answers due). J4c implements it. */
export function upcomingRequests(_s: RequestsState, _ctx: UpcomingContext): UpcomingEvent[] {
  return [];
}
