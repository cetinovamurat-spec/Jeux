/**
 * Time-zone free calendar dates as ISO strings 'YYYY-MM-DD'.
 * Day numbers count days since 1970-01-01 (UTC).
 */
export type IsoDate = string;

const MS_PER_DAY = 86_400_000;

export function isoDate(year: number, month: number, day: number): IsoDate {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function parts(date: IsoDate): { year: number; month: number; day: number } {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  return { year, month, day };
}

export function toDayNumber(date: IsoDate): number {
  const { year, month, day } = parts(date);
  return Math.round(Date.UTC(year, month - 1, day) / MS_PER_DAY);
}

export function fromDayNumber(dayNumber: number): IsoDate {
  const d = new Date(dayNumber * MS_PER_DAY);
  return isoDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Number of days from `from` to `to` (to − from). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return toDayNumber(to) - toDayNumber(from);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return fromDayNumber(toDayNumber(date) + days);
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function endOfMonth(year: number, month: number): IsoDate {
  return isoDate(year, month, daysInMonth(year, month));
}

/** Adds months, clamping the day to the end of the target month. */
export function addMonths(date: IsoDate, months: number): IsoDate {
  const { year, month, day } = parts(date);
  const index = year * 12 + (month - 1) + months;
  const y = Math.floor(index / 12);
  const m = (index % 12) + 1;
  return isoDate(y, m, Math.min(day, daysInMonth(y, m)));
}

export function addYears(date: IsoDate, years: number): IsoDate {
  return addMonths(date, years * 12);
}

/** 0 = Sunday … 6 = Saturday */
export function weekday(date: IsoDate): number {
  return new Date(toDayNumber(date) * MS_PER_DAY).getUTCDay();
}

export function isWeekend(date: IsoDate): boolean {
  const w = weekday(date);
  return w === 0 || w === 6;
}

/** Next business day on or after `date` (weekends only; public holidays ignored). */
export function businessDayOnOrAfter(date: IsoDate): IsoDate {
  let d = date;
  while (isWeekend(d)) d = addDays(d, 1);
  return d;
}

export function addBusinessDays(date: IsoDate, days: number): IsoDate {
  let d = date;
  let remaining = days;
  while (remaining > 0) {
    d = addDays(d, 1);
    if (!isWeekend(d)) remaining--;
  }
  return d;
}

export function minDate(a: IsoDate, b: IsoDate): IsoDate {
  return a <= b ? a : b;
}

export function maxDate(a: IsoDate, b: IsoDate): IsoDate {
  return a >= b ? a : b;
}

export function yearOf(date: IsoDate): number {
  return Number(date.slice(0, 4));
}

export function monthOf(date: IsoDate): number {
  return Number(date.slice(5, 7));
}

/** 'JJ/MM/AAAA' */
export function formatDateFr(date: IsoDate): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;
}

/** 'AAAAMMJJ' (FEC format) */
export function formatDateFec(date: IsoDate): string {
  return date.replaceAll('-', '');
}
