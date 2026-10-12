/**
 * Loan schedules. Livret A-indexed loans are revised at each due date: the rate
 * of a period is the Livret A rate in force at the period start plus the margin.
 * Interest = outstanding × rate × exact days / 365. ICNE at a date = interest
 * accrued since the start of the current period.
 */
import { addMonths, addDays, daysBetween } from '../dates';
import { roundCents, type Cents } from '../money';
import type { Loan, LoanScheduleLine } from '../types';

export interface RateChange {
  from: string;
  ratePct: number;
}

export function livretAAt(history: readonly RateChange[], date: string): number {
  let rate = history[0]?.ratePct ?? 0;
  for (const h of history) if (h.from <= date) rate = h.ratePct;
  return rate;
}

export function periodRate(loan: Loan, periodStart: string, history: readonly RateChange[]): number {
  const r = loan.rate;
  if (r.kind === 'fixed') return r.ratePct;
  if (r.kind === 'zeroThenLivretA') return periodStart < r.zeroUntil ? 0 : livretAAt(history, periodStart) + r.marginPct;
  const rate = livretAAt(history, periodStart) + r.marginPct;
  return Math.max(r.floorPct ?? 0, rate);
}

/** Schedule from refDate until the first due date after `until` (inclusive). */
export function buildSchedule(loan: Loan, history: readonly RateChange[], until: string): LoanScheduleLine[] {
  const lines: LoanScheduleLine[] = [];
  let outstanding = loan.refOutstanding;
  let periodStart = loan.refDate;
  let due = loan.nextDueDate;
  const n = loan.remainingPeriods;
  const deferred = loan.deferredPeriods ?? 0;
  for (let k = 1; k <= n && outstanding > 0; k++) {
    const rate = periodRate(loan, periodStart, history);
    const days = daysBetween(periodStart, due);
    const interest = roundCents((outstanding * rate * days) / 36500);
    let principal: Cents;
    const remaining = n - k + 1;
    if (k === n) principal = outstanding;
    else if (loan.amortisation === 'deferred' && k <= deferred) principal = 0;
    else if (loan.amortisation === 'constant') principal = roundCents(outstanding / remaining);
    else {
      const amortRemaining = loan.amortisation === 'deferred' ? n - Math.max(deferred, k - 1) : remaining;
      const rp = (rate / 100) * (loan.periodMonths / 12);
      const annuity = rp === 0 ? outstanding / amortRemaining : (outstanding * rp) / (1 - (1 + rp) ** -amortRemaining);
      principal = roundCents(Math.max(0, annuity - outstanding * rp));
    }
    principal = Math.min(principal, outstanding);
    outstanding -= principal;
    lines.push({ loanId: loan.id, dueDate: due, periodStart, ratePct: Math.round(rate * 10000) / 10000, interest, principal, early: false, outstandingAfter: outstanding });
    if (due > until) break;
    periodStart = due;
    due = addMonths(due, loan.periodMonths);
  }
  return lines;
}

/** Outstanding capital at the end of `date`. */
export function outstandingAt(loan: Loan, schedule: readonly LoanScheduleLine[], date: string): Cents {
  if (date < loan.refDate) return 0;
  let outstanding = loan.refOutstanding;
  for (const l of schedule) {
    if (l.dueDate <= date) outstanding = l.outstandingAfter;
    else break;
  }
  return outstanding;
}

/** Accrued interest not yet due (ICNE) at the end of `date`, at the loan's own rate or at a flat rate. */
export function accruedInterest(loan: Loan, schedule: readonly LoanScheduleLine[], date: string, flatRatePct?: number): Cents {
  if (date < loan.refDate) return 0;
  const current = schedule.find((l) => l.periodStart <= date && date < l.dueDate);
  if (!current) return 0;
  const outstanding = outstandingAt(loan, schedule, date);
  const rate = flatRatePct ?? current.ratePct;
  const days = daysBetween(current.periodStart, addDays(date, 1));
  return roundCents((outstanding * rate * days) / 36500);
}

export function scheduleTotals(schedule: readonly LoanScheduleLine[], year: number): { interest: Cents; principal: Cents } {
  let interest = 0;
  let principal = 0;
  for (const l of schedule) {
    if (l.dueDate.startsWith(`${year}-`)) {
      interest += l.interest;
      if (!l.early) principal += l.principal;
    }
  }
  return { interest, principal };
}
