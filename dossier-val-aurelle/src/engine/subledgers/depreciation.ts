/**
 * Straight-line depreciation by component.
 *
 * Convention (reproduces every figure of the specification): a full calendar
 * year counts for 1/L of the cost; a partial year counts exact days / 365.
 * Accumulated depreciation is rounded to the cent at each date, so yearly
 * charges never drift. A revised plan (demolition decided) depreciates the net
 * book value at the revision date linearly, in days, until its end date.
 */
import { addDays, daysBetween, isoDate, yearOf } from '../dates';
import { roundCents, type Cents } from '../money';
import type { AssetComponent, Subsidy } from '../types';

function fractionWithinYear(from: string, to: string): number {
  const y = yearOf(from);
  if (from === isoDate(y, 1, 1) && to === isoDate(y, 12, 31)) return 1;
  return (daysBetween(from, to) + 1) / 365;
}

/** Years of depreciation elapsed from `start` to `date` inclusive. */
export function elapsedYears(start: string, date: string): number {
  if (date < start) return 0;
  const y0 = yearOf(start);
  const y1 = yearOf(date);
  if (y0 === y1) return fractionWithinYear(start, date);
  return fractionWithinYear(start, isoDate(y0, 12, 31)) + (y1 - y0 - 1) + fractionWithinYear(isoDate(y1, 1, 1), date);
}

function normalAccumulated(c: AssetComponent, date: string): Cents {
  if (c.usefulLifeYears <= 0 || date < c.inServiceDate) return 0;
  const years = elapsedYears(c.inServiceDate, date);
  return roundCents(Math.min(c.cost, (c.cost * years) / c.usefulLifeYears));
}

/** Accumulated depreciation at the end of `date` (inclusive). */
export function accumulatedDepreciation(c: AssetComponent, date: string): Cents {
  if (c.usefulLifeYears <= 0) return 0;
  const effective = c.disposal && date > c.disposal.date ? c.disposal.date : date;
  if (c.revisedPlan && effective >= c.revisedPlan.from) {
    const before = normalAccumulated(c, addDays(c.revisedPlan.from, -1));
    const nbv = c.cost - before;
    const total = daysBetween(c.revisedPlan.from, c.revisedPlan.until) + 1;
    const elapsed = Math.min(total, daysBetween(c.revisedPlan.from, effective) + 1);
    return before + roundCents((nbv * elapsed) / total);
  }
  return normalAccumulated(c, effective);
}

/** Depreciation charge over [from, to] (inclusive dates). */
export function depreciationCharge(c: AssetComponent, from: string, to: string): Cents {
  return accumulatedDepreciation(c, to) - accumulatedDepreciation(c, addDays(from, -1));
}

export function netBookValue(c: AssetComponent, date: string): Cents {
  return c.cost - accumulatedDepreciation(c, date);
}

/** Whether the component is on the balance sheet at the end of `date`. */
export function isActive(c: AssetComponent, date: string): boolean {
  return c.inServiceDate <= date && !(c.disposal && c.disposal.date < date);
}

/**
 * Accumulated share of a subsidy taken to income (quote-part virée au résultat)
 * at the end of `date`: subsidy × accumulated depreciation / depreciable base of
 * the financed components. When a component leaves the balance sheet, its whole
 * share is taken to income.
 */
export function accumulatedSubsidyRelease(s: Subsidy, components: readonly AssetComponent[], date: string): Cents {
  if (s.cancelledOn && s.cancelledOn <= date) return 0;
  const financed = components.filter((c) => c.operationId === s.operationId && c.usefulLifeYears > 0);
  const base = financed.reduce((a, c) => a + c.cost, 0);
  if (base === 0) return 0;
  let released = 0;
  for (const c of financed) {
    if (c.disposal && c.disposal.date <= date) released += c.cost;
    else released += accumulatedDepreciation(c, date);
  }
  return roundCents(Math.min(s.amount, (s.amount * released) / base));
}
