/**
 * Analytical review (revue analytique) — pure helpers: variations against
 * user thresholds, HLM ratios computed from closing balances and key figures,
 * time-weighted Livret A rate, monthly rents from FEC lines.
 *
 * The account groupings below are proposals to validate (they belong with
 * the other analysis conventions); every ratio is generic: nothing here
 * knows about the anomalies of the case.
 */
import type { PrefixRule } from '../engine/analysis';
import { OPENING_JOURNAL, sumPrefixes } from '../engine/balance';
import { addDays, daysBetween, isoDate, maxDate, minDate, type IsoDate } from '../engine/dates';
import type { Cents } from '../engine/money';
import type { FecLineInternal, StatementId, StatementLineDef, StatementLineValue } from '../engine/types';

// ---------------------------------------------------------------------------
// Conventions (proposals to validate)
// ---------------------------------------------------------------------------

export interface RatioConventions {
  /** Interest on loans (intérêts des emprunts), added to capital repayments for the debt service. */
  loanInterest: PrefixRule;
  /** Gross rent receivables (créances locatives brutes, before impairment). */
  rentReceivables: PrefixRule;
  /** Billed rents (loyers quittancés, before RLS). */
  billedRents: PrefixRule;
  /** Rents of the monthly chart (dwellings, commercial premises, parking; residences billed separately). */
  monthlyRents: readonly string[];
  /** Management cost: staff, other external services, taxes other than property tax and household waste tax. */
  managementCost: PrefixRule;
}

export const RATIO_CONVENTIONS: RatioConventions = {
  loanInterest: { include: ['6611'] },
  rentReceivables: { include: ['4111', '4114', '4115', '4116'] },
  billedRents: { include: ['70411', '70412', '70413', '70414', '70415'] },
  monthlyRents: ['70411', '70412', '70414', '70415'],
  managementCost: { include: ['641', '645', '62', '635'], exclude: ['63512', '63513'] },
};

/** Default thresholds of the variation review (generic starting point, editable by the player). */
export const DEFAULT_VARIATION_THRESHOLDS = { pct: 10, euros: 100_000 } as const;

// ---------------------------------------------------------------------------
// Small numeric helpers
// ---------------------------------------------------------------------------

/** n / d, or null when the denominator is zero. */
export function safeRatio(n: number, d: number): number | null {
  return d === 0 ? null : n / d;
}

/** Debit-positive sum of closing balances matching a prefix rule. */
export function sumRule(balances: ReadonlyMap<string, Cents>, rule: PrefixRule): Cents {
  return sumPrefixes(balances, rule.include, rule.exclude ?? []);
}

/**
 * Parses a threshold typed by the player ('10', '7,5', '100 000'); returns
 * its absolute value, or null when the field is empty or not a number.
 */
export function parseThreshold(text: string): number | null {
  const s = text.replace(/[\s  ]/g, '').replace(',', '.');
  if (s === '' || !/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  const v = Math.abs(Number(s));
  return Number.isFinite(v) ? v : null;
}

// ---------------------------------------------------------------------------
// Variations and thresholds
// ---------------------------------------------------------------------------

export interface Variation {
  /** current − prior */
  amount: Cents;
  /** amount / |prior|; null when the prior value is zero. */
  ratio: number | null;
}

export function variation(current: Cents, prior: Cents): Variation {
  return { amount: current - prior, ratio: prior === 0 ? null : (current - prior) / Math.abs(prior) };
}

/** Thresholds of the review: null = not applied. `amount` in cents, `pct` in percent. */
export interface VariationThresholds {
  pct: number | null;
  amount: Cents | null;
}

/**
 * A variation is flagged when it exceeds every threshold that is set (in
 * absolute value). No threshold set → nothing is flagged. A line that was
 * zero the previous year exceeds any percentage threshold.
 */
export function exceedsThresholds(v: Variation, t: VariationThresholds): boolean {
  if (t.pct === null && t.amount === null) return false;
  if (v.amount === 0) return false;
  const amountOk = t.amount === null || Math.abs(v.amount) > t.amount;
  const pctOk = t.pct === null || v.ratio === null || Math.abs(v.ratio) * 100 > t.pct;
  return amountOk && pctOk;
}

export interface StatementVariationRow {
  id: string;
  label: string;
  statement: StatementId;
  kind: StatementLineDef['kind'];
  /** Depth in the statement tree (0 = root). */
  depth: number;
  current: Cents;
  prior: Cents;
  variation: Variation;
  flagged: boolean;
}

/**
 * Lines of one or several statements in reading order: a subtotal comes
 * before its children (heading), a total after them (closing line).
 */
export function statementOrder(defs: readonly StatementLineDef[], statements: readonly StatementId[]): { def: StatementLineDef; depth: number }[] {
  const selected = defs.filter((d) => statements.includes(d.statement));
  const children = new Map<string, StatementLineDef[]>();
  for (const d of selected) if (d.parent) children.set(d.parent, [...(children.get(d.parent) ?? []), d]);
  const ids = new Set(selected.map((d) => d.id));
  const out: { def: StatementLineDef; depth: number }[] = [];
  const visit = (d: StatementLineDef, depth: number) => {
    const kids = children.get(d.id) ?? [];
    const closing = d.kind === 'total' && kids.length > 0;
    if (!closing) out.push({ def: d, depth });
    for (const k of kids) visit(k, closing ? depth : depth + 1);
    if (closing) out.push({ def: d, depth });
  };
  for (const st of statements) for (const d of selected) if (d.statement === st && (!d.parent || !ids.has(d.parent))) visit(d, 0);
  return out;
}

export function statementVariations(
  defs: readonly StatementLineDef[],
  lines: Readonly<Record<string, StatementLineValue>>,
  statements: readonly StatementId[],
  thresholds: VariationThresholds,
): StatementVariationRow[] {
  return statementOrder(defs, statements).map(({ def, depth }) => {
    const current = lines[def.id]?.current ?? 0;
    const prior = lines[def.id]?.prior ?? 0;
    const v = variation(current, prior);
    return { id: def.id, label: def.label, statement: def.statement, kind: def.kind, depth, current, prior, variation: v, flagged: exceedsThresholds(v, thresholds) };
  });
}

/** Detail charge lines of the income statement (structure of charges). */
export function chargeLines(defs: readonly StatementLineDef[], lines: Readonly<Record<string, StatementLineValue>>): { id: string; label: string; current: Cents; prior: Cents }[] {
  return defs
    .filter((d) => d.statement === 'income' && d.kind === 'detail' && d.nature === 'charge')
    .map((d) => ({ id: d.id, label: d.label, current: lines[d.id]?.current ?? 0, prior: lines[d.id]?.prior ?? 0 }));
}

// ---------------------------------------------------------------------------
// HLM ratios
// ---------------------------------------------------------------------------

export interface RatioInputs {
  balances: ReadonlyMap<string, Cents>;
  /** Net rents (KeyFigures.rents). */
  rents: Cents;
  ebeOnRents: number;
  /** Capital repayments of the rental loans, early repayments excluded (KeyFigures.loanRepayments). */
  loanRepayments: Cents;
  financialCharges: Cents;
  netSelfFinancingRatio: number;
  /** Family dwellings in the stock at 31/12 and vacancy rate at that date. */
  dwellings: number;
  vacancyRate: number;
}

export interface DebtService {
  repayments: Cents;
  interest: Cents;
  annuities: Cents;
  rents: Cents;
  ratio: number | null;
}

export interface RentArrears {
  receivables: Cents;
  billedRents: Cents;
  ratio: number | null;
}

export interface ManagementCost {
  cost: Cents;
  dwellings: number;
  /** Rounded to the cent. */
  perDwelling: Cents | null;
}

export interface HlmRatios {
  netSelfFinancing: number;
  ebeOnRents: number;
  debtService: DebtService;
  financialChargesOnRents: { charges: Cents; rents: Cents; ratio: number | null };
  vacancy: { rate: number; dwellings: number };
  arrears: RentArrears;
  managementCost: ManagementCost;
}

/** Annuities / rents = (capital repayments + loan interest) / net rents. */
export function debtService(balances: ReadonlyMap<string, Cents>, loanRepayments: Cents, rents: Cents, conv: RatioConventions = RATIO_CONVENTIONS): DebtService {
  const interest = sumRule(balances, conv.loanInterest);
  const annuities = loanRepayments + interest;
  return { repayments: loanRepayments, interest, annuities, rents, ratio: safeRatio(annuities, rents) };
}

/** Gross rent receivables / billed rents (credit balances of the rent accounts). */
export function rentArrears(balances: ReadonlyMap<string, Cents>, conv: RatioConventions = RATIO_CONVENTIONS): RentArrears {
  const receivables = sumRule(balances, conv.rentReceivables);
  const billedRents = -sumRule(balances, conv.billedRents);
  return { receivables, billedRents, ratio: safeRatio(receivables, billedRents) };
}

/** Management cost per family dwelling in the stock at 31/12. */
export function managementCost(balances: ReadonlyMap<string, Cents>, dwellings: number, conv: RatioConventions = RATIO_CONVENTIONS): ManagementCost {
  const cost = sumRule(balances, conv.managementCost);
  return { cost, dwellings, perDwelling: dwellings === 0 ? null : Math.round(cost / dwellings) };
}

export function hlmRatios(i: RatioInputs, conv: RatioConventions = RATIO_CONVENTIONS): HlmRatios {
  return {
    netSelfFinancing: i.netSelfFinancingRatio,
    ebeOnRents: i.ebeOnRents,
    debtService: debtService(i.balances, i.loanRepayments, i.rents, conv),
    financialChargesOnRents: { charges: i.financialCharges, rents: i.rents, ratio: safeRatio(i.financialCharges, i.rents) },
    vacancy: { rate: i.vacancyRate, dwellings: i.dwellings },
    arrears: rentArrears(i.balances, conv),
    managementCost: managementCost(i.balances, i.dwellings, conv),
  };
}

// ---------------------------------------------------------------------------
// Net self-financing series and three-year mean
// ---------------------------------------------------------------------------

export interface YearRatio {
  year: number;
  ratio: number;
  source: 'history' | 'computed';
}

/** History (2021-2023 aggregates, in percent) merged with the computed ratios; computed values win. */
export function netSelfFinancingSeries(history: readonly { year: number; netSelfFinancingRatioPct: number }[], computed: readonly { year: number; ratio: number }[]): YearRatio[] {
  const m = new Map<number, YearRatio>();
  for (const h of history) m.set(h.year, { year: h.year, ratio: h.netSelfFinancingRatioPct / 100, source: 'history' });
  for (const c of computed) m.set(c.year, { year: c.year, ratio: c.ratio, source: 'computed' });
  return [...m.values()].sort((a, b) => a.year - b.year);
}

/** Mean of the ratios of the `n` years ending with `year`; null when one of them is missing. */
export function trailingMean(series: readonly { year: number; ratio: number }[], year: number, n = 3): number | null {
  let sum = 0;
  for (let y = year - n + 1; y <= year; y++) {
    const r = series.find((s) => s.year === y);
    if (!r) return null;
    sum += r.ratio;
  }
  return sum / n;
}

// ---------------------------------------------------------------------------
// Livret A: time-weighted average rate of a year
// ---------------------------------------------------------------------------

export interface RatePeriod {
  from: IsoDate;
  to: IsoDate;
  days: number;
  ratePct: number;
}

export interface AverageRate {
  year: number;
  periods: RatePeriod[];
  /** Days of the year covered by the history (a rate applies from its date until the next one). */
  coveredDays: number;
  daysInYear: number;
  /** Time-weighted average over the covered days; null when no day is covered. */
  averagePct: number | null;
}

export function timeWeightedRate(history: readonly { from: IsoDate; ratePct: number }[], year: number): AverageRate {
  const start = isoDate(year, 1, 1);
  const end = isoDate(year, 12, 31);
  const daysInYear = daysBetween(start, end) + 1;
  const sorted = [...history].sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
  const periods: RatePeriod[] = [];
  sorted.forEach((h, i) => {
    const next = sorted[i + 1];
    const from = maxDate(h.from, start);
    const to = next ? minDate(addDays(next.from, -1), end) : end;
    if (from > to) return;
    periods.push({ from, to, days: daysBetween(from, to) + 1, ratePct: h.ratePct });
  });
  const coveredDays = periods.reduce((s, p) => s + p.days, 0);
  const weighted = periods.reduce((s, p) => s + p.days * p.ratePct, 0);
  return { year, periods, coveredDays, daysInYear, averagePct: coveredDays === 0 ? null : weighted / coveredDays };
}

// ---------------------------------------------------------------------------
// Monthly rents from the FEC
// ---------------------------------------------------------------------------

export type MonthlyFecLine = Pick<FecLineInternal, 'JournalCode' | 'CompteNum' | 'EcritureDate' | 'creditCents'>;

/**
 * Sum of the credits posted to the given accounts (prefixes), by month of
 * EcritureDate (index 0 = January); opening entries (AN) are excluded.
 */
export function monthlyCredits(lines: readonly MonthlyFecLine[], accounts: readonly string[], excludeJournals: readonly string[] = [OPENING_JOURNAL]): Cents[] {
  const out: Cents[] = Array.from({ length: 12 }, () => 0);
  for (const l of lines) {
    if (l.creditCents === 0 || excludeJournals.includes(l.JournalCode)) continue;
    if (!accounts.some((a) => l.CompteNum.startsWith(a))) continue;
    const month = Number(l.EcritureDate.slice(4, 6));
    if (month >= 1 && month <= 12) out[month - 1]! += l.creditCents;
  }
  return out;
}
