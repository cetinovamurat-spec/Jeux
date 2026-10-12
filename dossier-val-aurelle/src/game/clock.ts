/** Game calendar (§4.6): period of the engagement at a date. Pure. */
import type { IsoDate } from '../engine/dates';

export interface CalendarPeriod {
  id: string;
  label: string;
  from: IsoDate;
  to: IsoDate;
}

/** Current period, or the gap between two periods. */
export function periodAt(calendar: readonly CalendarPeriod[], date: IsoDate): { current?: CalendarPeriod; next?: CalendarPeriod; previous?: CalendarPeriod } {
  const sorted = [...calendar].sort((a, b) => (a.from < b.from ? -1 : 1));
  const current = sorted.find((p) => p.from <= date && date <= p.to);
  const next = sorted.find((p) => p.from > date);
  const previous = [...sorted].reverse().find((p) => p.to < date);
  return { ...(current ? { current } : {}), ...(next ? { next } : {}), ...(previous ? { previous } : {}) };
}
