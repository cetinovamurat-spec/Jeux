/**
 * Desk agenda: status of the engagement periods at the game date and the
 * layout of a small Gantt chart (months header, bars, today marker). Pure.
 */
import { daysBetween, endOfMonth, isoDate, maxDate, minDate, parts, type IsoDate } from '../../../engine/dates';
import type { CalendarPeriod } from '../../../game/clock';

export type PeriodStatus = 'past' | 'current' | 'upcoming';

export function periodStatus(p: CalendarPeriod, date: IsoDate): PeriodStatus {
  if (p.to < date) return 'past';
  if (p.from > date) return 'upcoming';
  return 'current';
}

export const STATUS_LABEL: Record<PeriodStatus, string> = { past: 'Terminé', current: 'En cours', upcoming: 'À venir' };

/** Short French month names (labels of the Gantt header). */
const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'] as const;

export function sortPeriods(calendar: readonly CalendarPeriod[]): CalendarPeriod[] {
  return [...calendar].sort((a, b) => (a.from === b.from ? (a.to < b.to ? -1 : a.to > b.to ? 1 : 0) : a.from < b.from ? -1 : 1));
}

export interface TimelineBar {
  period: CalendarPeriod;
  status: PeriodStatus;
  leftPct: number;
  widthPct: number;
  /** Single-day period (rendered as a milestone marker). */
  milestone: boolean;
}

export interface TimelineMonth {
  label: string;
  year: number;
  leftPct: number;
  widthPct: number;
}

export interface TimelineYear {
  year: number;
  leftPct: number;
  widthPct: number;
}

export interface Timeline {
  from: IsoDate;
  to: IsoDate;
  bars: TimelineBar[];
  months: TimelineMonth[];
  years: TimelineYear[];
  /** Position of the middle of the game day. */
  todayPct: number;
}

/**
 * Timeline from the first day of the month of the earliest period (or of the
 * game date, if earlier) to the last day of the month of the latest one.
 */
export function buildTimeline(calendar: readonly CalendarPeriod[], date: IsoDate): Timeline {
  const sorted = sortPeriods(calendar);
  let lo = date;
  let hi = date;
  for (const p of sorted) {
    lo = minDate(lo, p.from);
    hi = maxDate(hi, p.to);
  }
  const a = parts(lo);
  const b = parts(hi);
  const from = isoDate(a.year, a.month, 1);
  const to = endOfMonth(b.year, b.month);
  const span = daysBetween(from, to) + 1;
  const pct = (days: number) => (days / span) * 100;

  const bars = sorted.map((p) => ({
    period: p,
    status: periodStatus(p, date),
    leftPct: pct(daysBetween(from, p.from)),
    widthPct: pct(daysBetween(p.from, p.to) + 1),
    milestone: p.from === p.to,
  }));

  const months: TimelineMonth[] = [];
  const years: TimelineYear[] = [];
  let y = a.year;
  let m = a.month;
  while (y < b.year || (y === b.year && m <= b.month)) {
    const start = isoDate(y, m, 1);
    const end = endOfMonth(y, m);
    const leftPct = pct(daysBetween(from, start));
    const widthPct = pct(daysBetween(start, end) + 1);
    months.push({ label: MONTHS_SHORT[m - 1] ?? String(m), year: y, leftPct, widthPct });
    const last = years[years.length - 1];
    if (last && last.year === y) last.widthPct += widthPct;
    else years.push({ year: y, leftPct, widthPct });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }

  return { from, to, bars, months, years, todayPct: pct(daysBetween(from, date) + 0.5) };
}

/** 'aujourd’hui', 'demain', 'dans 12 jours', 'hier', 'il y a 3 jours'. */
export function relativeDays(days: number): string {
  if (days === 0) return 'aujourd’hui';
  if (days === 1) return 'demain';
  if (days === -1) return 'hier';
  return days > 0 ? `dans ${days} jours` : `il y a ${-days} jours`;
}

/** 'le 26/03/2026' or 'du 23/02/2026 au 13/03/2026'. */
export function periodDates(p: { from: IsoDate; to: IsoDate }, format: (d: IsoDate) => string): string {
  return p.from === p.to ? `le ${format(p.from)}` : `du ${format(p.from)} au ${format(p.to)}`;
}
