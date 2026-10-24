/**
 * Working calendar of the game (§4.6, §10.2): working days (weekends and
 * public holidays excluded), presence of the team on site, daily capacity
 * and scheduling of the work of each member. Pure.
 *
 * Distinct from engine/dates.addBusinessDays, which the generator uses for
 * the dates of the accounting world and which ignores public holidays: the
 * world (and the scenario lock) must not depend on the game calendar.
 */
import { addDays, isWeekend, toDayNumber, type IsoDate } from '../engine/dates';
import type { Params } from '../scenario/params';
import { periodAt, type CalendarPeriod } from './clock';

export type MemberId = 'senior' | 'lea' | 'hugo' | 'sofia';
export const MEMBERS: readonly MemberId[] = ['senior', 'lea', 'hugo', 'sofia'];

export interface WorkCalendar {
  periods: readonly CalendarPeriod[];
  holidays: ReadonlySet<IsoDate>;
  /** Calendar periods during which each member works on site. */
  onSite: Readonly<Record<MemberId, ReadonlySet<string>>>;
  capacityHoursPerDay: number;
}

export function workCalendar(params: Params): WorkCalendar {
  const g = params.game;
  const onSite = {} as Record<MemberId, ReadonlySet<string>>;
  for (const m of MEMBERS) onSite[m] = new Set(g.onSite.members[m] ?? []);
  return { periods: g.calendar, holidays: new Set(g.holidays.dates), onSite, capacityHoursPerDay: g.onSite.capacityHoursPerDay };
}

export function isWorkingDay(cal: WorkCalendar, date: IsoDate): boolean {
  return !isWeekend(date) && !cal.holidays.has(date);
}

/** The date itself when it is a working day, otherwise the next working day. */
export function workingDayOnOrAfter(cal: WorkCalendar, date: IsoDate): IsoDate {
  let d = date;
  while (!isWorkingDay(cal, d)) d = addDays(d, 1);
  return d;
}

/** First working day strictly after the date. */
export function nextWorkingDay(cal: WorkCalendar, date: IsoDate): IsoDate {
  return workingDayOnOrAfter(cal, addDays(date, 1));
}

/** Adds n working days (n ≥ 0); 0 gives the date itself when it is a working day, otherwise the next one. */
export function addWorkingDays(cal: WorkCalendar, date: IsoDate, n: number): IsoDate {
  let d = workingDayOnOrAfter(cal, date);
  for (let i = 0; i < n; i++) d = nextWorkingDay(cal, d);
  return d;
}

/** Number of weekdays (Monday to Friday) from 1970-01-01 to the date included. */
function weekdaysUpTo(date: IsoDate): number {
  const n = toDayNumber(date);
  // day 0 (1970-01-01) is a Thursday: shift so that a week starts on Monday
  const shifted = n + 3;
  const weeks = Math.floor(shifted / 7);
  const rest = shifted - weeks * 7; // 0 = Monday … 6 = Sunday
  return weeks * 5 + Math.min(rest + 1, 5);
}

/** Number of working days after `from` up to `to` included (0 when `to` ≤ `from`), computed without walking the days. */
export function workingDaysBetween(cal: WorkCalendar, from: IsoDate, to: IsoDate): number {
  if (to <= from) return 0;
  let n = weekdaysUpTo(to) - weekdaysUpTo(from);
  for (const h of cal.holidays) if (h > from && h <= to && !isWeekend(h)) n--;
  return n;
}

/** Calendar period id at a date (undefined between periods: off site). */
export function periodIdAt(cal: WorkCalendar, date: IsoDate): string | undefined {
  return periodAt(cal.periods, date).current?.id;
}

/** The member works on site that day (working day within one of the member's periods). */
export function isOnSite(cal: WorkCalendar, member: MemberId, date: IsoDate): boolean {
  if (!isWorkingDay(cal, date)) return false;
  const p = periodIdAt(cal, date);
  return p !== undefined && cal.onSite[member].has(p);
}

/** Last date of the calendar: nothing is scheduled after it. */
export function calendarEnd(cal: WorkCalendar): IsoDate {
  return cal.periods.reduce((m, p) => (p.to > m ? p.to : m), cal.periods[0]?.to ?? '9999-12-31');
}

/** Next day (on or after the date) on which the member works on site, or null when there is none before the end of the calendar. */
export function nextOnSiteDay(cal: WorkCalendar, member: MemberId, date: IsoDate): IsoDate | null {
  const end = calendarEnd(cal);
  for (let d = date; d <= end; d = addDays(d, 1)) if (isOnSite(cal, member, d)) return d;
  return null;
}

// ---------------------------------------------------------------------------
// scheduling of the work of each member
// ---------------------------------------------------------------------------

export interface Task {
  id: string;
  member: MemberId;
  hours: number;
  /** Launch date: the work cannot start before it. */
  earliest: IsoDate;
}

export interface ScheduledTask extends Task {
  /** First day of work, or null when the member is never on site again. */
  start: IsoDate | null;
  /** Day the work is finished (the worksheet is delivered that day), or null when it cannot be finished before the end of the calendar. */
  end: IsoDate | null;
}

/**
 * Schedules the tasks of each member one after the other, in the order given
 * (launch order), at `capacityHoursPerDay` per working day on site; a day's
 * unused capacity is lost. Tasks of 0 hours finish on their start day.
 */
export function schedule(cal: WorkCalendar, tasks: readonly Task[]): ScheduledTask[] {
  const cursor = new Map<MemberId, { date: IsoDate; used: number }>();
  const cap = cal.capacityHoursPerDay;
  return tasks.map((t) => {
    const c = cursor.get(t.member);
    // first possible day: after the member's previous task and not before the launch
    let date = c && c.date > t.earliest ? c.date : t.earliest;
    let used = c && c.date === date ? c.used : 0;
    if (used >= cap) {
      date = addDays(date, 1);
      used = 0;
    }
    const first = nextOnSiteDay(cal, t.member, date);
    if (first === null) return { ...t, start: null, end: null };
    if (first !== date) used = 0;
    date = first;
    let left = t.hours;
    const start = date;
    for (;;) {
      const take = Math.min(left, cap - used);
      used += take;
      left -= take;
      if (left <= 1e-9) break;
      const next = nextOnSiteDay(cal, t.member, addDays(date, 1));
      if (next === null) {
        cursor.set(t.member, { date: addDays(calendarEnd(cal), 1), used: 0 });
        return { ...t, start, end: null };
      }
      date = next;
      used = 0;
    }
    cursor.set(t.member, { date, used });
    return { ...t, start, end: date };
  });
}
