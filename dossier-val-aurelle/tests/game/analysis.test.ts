/** Analytical review helpers (src/game/analysis.ts) on synthetic data: thresholds, variations, HLM ratios, Livret A average rate, monthly rents. */
import { describe, expect, it } from 'vitest';
import type { StatementLineDef, StatementLineValue } from '../../src/engine/types';
import {
  chargeLines,
  debtService,
  exceedsThresholds,
  hlmRatios,
  managementCost,
  meetsReference,
  monthlyCredits,
  netSelfFinancingSeries,
  readThreshold,
  rentAccountsLeftOut,
  rentArrears,
  ruleCovers,
  safeRatio,
  statementOrder,
  statementVariations,
  timeWeightedRate,
  toThresholds,
  trailingMean,
  variation,
  type MonthlyFecLine,
} from '../../src/game/analysis';
import { loadParams } from '../../src/scenario/params';

const ANALYSIS = loadParams().analysis;
const REVIEW = ANALYSIS.review;
const RATIO_CONVENTIONS = REVIEW.hlmRatios;
const DEFAULT_VARIATION_THRESHOLDS = REVIEW.variationThresholds;

describe('threshold inputs', () => {
  it('reads French decimals, grouped thousands and signs as absolute values', () => {
    expect(readThreshold('10')).toEqual({ value: 10, invalid: false });
    expect(readThreshold('7,5')).toEqual({ value: 7.5, invalid: false });
    expect(readThreshold('100 000')).toEqual({ value: 100000, invalid: false });
    expect(readThreshold('100 000')).toEqual({ value: 100000, invalid: false });
    expect(readThreshold('-5')).toEqual({ value: 5, invalid: false });
  });
  it('distinguishes an empty field from an unreadable one', () => {
    expect(readThreshold('')).toEqual({ value: null, invalid: false });
    expect(readThreshold('   ')).toEqual({ value: null, invalid: false });
    expect(readThreshold('dix')).toEqual({ value: null, invalid: true });
    expect(readThreshold('1,2,3')).toEqual({ value: null, invalid: true });
  });
  it('converts euros to cents once, with rounding', () => {
    expect(toThresholds(10, 100000)).toEqual({ pct: 10, amount: 10_000_000 });
    expect(toThresholds(null, 0.105)).toEqual({ pct: null, amount: 11 });
    expect(toThresholds(5, null)).toEqual({ pct: 5, amount: null });
  });
  it('has generic defaults', () => {
    expect(DEFAULT_VARIATION_THRESHOLDS.pct).toBeGreaterThan(0);
    expect(DEFAULT_VARIATION_THRESHOLDS.euros).toBeGreaterThan(0);
  });
});

describe('variations and thresholds', () => {
  const t = { pct: 10, amount: 100_000 };
  it('computes the variation against the prior value', () => {
    expect(variation(1000, 1250)).toEqual({ amount: 250, ratio: 0.25 });
    expect(variation(-1000, -500)).toEqual({ amount: 500, ratio: 0.5 });
    expect(variation(0, 300)).toEqual({ amount: 300, ratio: null });
  });
  it('flags a variation only when it exceeds both thresholds', () => {
    expect(exceedsThresholds(variation(1_000_000, 1_200_000), t)).toBe(true); // +200 000 cents, +20 %
    expect(exceedsThresholds(variation(1_000_000, 800_000), t)).toBe(true); // decreases count too
    expect(exceedsThresholds(variation(10_000_000, 10_200_000), t)).toBe(false); // amount above, 2 % below
    expect(exceedsThresholds(variation(100_000, 150_000), t)).toBe(false); // 50 % but amount below
    expect(exceedsThresholds(variation(1_000_000, 1_100_000), t)).toBe(false); // exactly on both thresholds
  });
  it('treats a line without prior value as above any percentage threshold', () => {
    expect(exceedsThresholds(variation(0, 500_000), t)).toBe(true);
    expect(exceedsThresholds(variation(0, 50_000), t)).toBe(false);
    expect(exceedsThresholds(variation(0, 0), t)).toBe(false);
  });
  it('applies only the thresholds that are set', () => {
    expect(exceedsThresholds(variation(100_000, 150_000), { pct: 10, amount: null })).toBe(true);
    expect(exceedsThresholds(variation(10_000_000, 10_200_000), { pct: null, amount: 100_000 })).toBe(true);
    expect(exceedsThresholds(variation(1, 1_000_000), { pct: null, amount: null })).toBe(false);
  });
});

describe('statement lines', () => {
  const defs: StatementLineDef[] = [
    { id: 'TOT', statement: 'assets', label: 'Total', kind: 'total' },
    { id: 'S1', statement: 'assets', label: 'Sub 1', kind: 'subtotal', parent: 'TOT' },
    { id: 'D1', statement: 'assets', label: 'Detail 1', kind: 'detail', parent: 'S1' },
    { id: 'D2', statement: 'assets', label: 'Detail 2', kind: 'detail', parent: 'S1' },
    { id: 'D3', statement: 'assets', label: 'Detail 3', kind: 'detail', parent: 'TOT' },
    { id: 'P', statement: 'income', label: 'Products', kind: 'subtotal', nature: 'product' },
    { id: 'P1', statement: 'income', label: 'Rents', kind: 'detail', parent: 'P', nature: 'product' },
    { id: 'C', statement: 'income', label: 'Charges', kind: 'subtotal', nature: 'charge' },
    { id: 'C1', statement: 'income', label: 'Staff', kind: 'detail', parent: 'C', nature: 'charge' },
    { id: 'C2', statement: 'income', label: 'Interest', kind: 'detail', parent: 'C', nature: 'charge' },
    { id: 'R', statement: 'income', label: 'Result', kind: 'total', formula: ['+P', '-C'] },
  ];
  const v = (id: string, current: number, prior: number): StatementLineValue => ({ id, current, prior });
  const lines: Record<string, StatementLineValue> = {
    D1: v('D1', 500, 400),
    D2: v('D2', 100, 100),
    S1: v('S1', 600, 500),
    D3: v('D3', 0, 50),
    TOT: v('TOT', 600, 550),
    P1: v('P1', 1000, 900),
    P: v('P', 1000, 900),
    C1: v('C1', 300, 300),
    C2: v('C2', 100, 0),
    C: v('C', 400, 300),
    R: v('R', 600, 600),
  };

  it('puts subtotals before their children and totals after them', () => {
    const order = statementOrder(defs, ['assets']);
    expect(order.map((o) => `${o.def.id}:${o.depth}`)).toEqual(['S1:0', 'D1:1', 'D2:1', 'D3:0', 'TOT:0']);
    expect(statementOrder(defs, ['income']).map((o) => o.def.id)).toEqual(['P', 'P1', 'C', 'C1', 'C2', 'R']);
  });

  it('computes the variation of every line and flags it against the thresholds', () => {
    const rows = statementVariations(defs, lines, ['assets', 'income'], { pct: 10, amount: 50 });
    expect(rows.map((r) => r.id)).toEqual(['S1', 'D1', 'D2', 'D3', 'TOT', 'P', 'P1', 'C', 'C1', 'C2', 'R']);
    const byId = new Map(rows.map((r) => [r.id, r]));
    expect(byId.get('D1')).toMatchObject({ current: 500, prior: 400, variation: { amount: 100, ratio: 0.25 }, flagged: true });
    expect(byId.get('D2')!.flagged).toBe(false);
    expect(byId.get('D3')).toMatchObject({ variation: { amount: -50, ratio: -1 }, flagged: false }); // amount not above 50
    expect(byId.get('C2')).toMatchObject({ variation: { amount: 100, ratio: null }, flagged: true });
    expect(byId.get('R')!.flagged).toBe(false);
  });

  it('reads a missing line as zero', () => {
    const rows = statementVariations(defs, {}, ['income'], { pct: null, amount: null });
    expect(rows.every((r) => r.current === 0 && r.prior === 0 && !r.flagged)).toBe(true);
  });

  it('lists the detail charge lines with their share of the charges of the year', () => {
    const charges = chargeLines(defs, lines);
    expect(charges.map((c) => c.id)).toEqual(['C1', 'C2']);
    expect(charges[0]).toMatchObject({ current: 300, prior: 300, shareCurrent: 0.75, sharePrior: 1 });
    expect(charges[1]).toMatchObject({ current: 100, prior: 0, shareCurrent: 0.25, sharePrior: 0 });
    expect(chargeLines(defs, {}).every((c) => c.shareCurrent === null && c.sharePrior === null)).toBe(true);
  });
});

describe('HLM ratios', () => {
  // Debit positive, credit negative (closing balances).
  const balances = new Map<string, number>([
    ['6611', 400_000],
    ['6618', 999], // other financial charges: not loan interest
    ['4111', 150_000],
    ['4114', 20_000],
    ['4115', 25_000],
    ['4116', 25_000],
    ['4181', 7_777], // charge regularisation to bill: not in the convention
    ['491', -60_000], // impairment: gross receivables are used
    ['70411', -1_500_000],
    ['70412', -200_000],
    ['70413', -100_000],
    ['70414', -150_000],
    ['70415', -50_000],
    ['70491', 300_000], // RLS (debit): deducted from the billed rents
    ['7031', -500_000], // charges billed: same basis as the receivables
    ['7088', -77_777], // other products: not billed to tenants
    ['6411', 250_000],
    ['6451', 100_000],
    ['6475', 5_000], // every staff account
    ['6226', 40_000],
    ['6281', 60_000],
    ['6131', 15_000], // equipment rentals: non-recoverable, not maintenance
    ['6156', 25_000], // IT maintenance: idem
    ['616', 45_000], // insurance: idem
    ['6111', 70_000], // cleaning of common areas: recoverable, left out
    ['614', 30_000], // co-ownership charges: left out
    ['61521', 500_000], // maintenance: not a management cost
    ['63512', 300_000], // property tax: excluded
    ['63513', 80_000], // household waste tax: excluded
    ['6358', 10_000],
  ]);

  it('debt service = capital repayments + loan interest, over net rents', () => {
    expect(debtService(balances, 600_000, 2_000_000, RATIO_CONVENTIONS)).toEqual({ repayments: 600_000, interest: 400_000, annuities: 1_000_000, rents: 2_000_000, ratio: 0.5 });
    expect(debtService(balances, 600_000, 0, RATIO_CONVENTIONS).ratio).toBeNull();
  });

  it('rent arrears = gross rent receivables / rents and charges billed, net of the RLS', () => {
    // 2 000 000 of rents − 300 000 of RLS + 500 000 of charges
    expect(rentArrears(balances, RATIO_CONVENTIONS)).toEqual({ receivables: 220_000, billedRentsAndCharges: 2_200_000, ratio: 0.1 });
    expect(rentArrears(new Map(), RATIO_CONVENTIONS).ratio).toBeNull();
  });

  it('management cost per dwelling: staff, non-recoverable external services other than maintenance, taxes other than property and household waste taxes', () => {
    // 250 000 + 100 000 + 5 000 (64) + 40 000 + 60 000 (62) + 15 000 + 25 000 + 45 000 (6131, 6156, 616) + 10 000 (6358)
    expect(managementCost(balances, 4, RATIO_CONVENTIONS)).toEqual({ cost: 550_000, dwellings: 4, perDwelling: 137_500 });
    expect(managementCost(balances, 3, RATIO_CONVENTIONS).perDwelling).toBe(183_333);
    expect(managementCost(balances, 0, RATIO_CONVENTIONS).perDwelling).toBeNull();
  });

  it('assembles the ratios from balances and key figures', () => {
    const r = hlmRatios({ balances, rents: 1_700_000, ebeOnRents: 0.52, loanRepayments: 450_000, financialCharges: 425_000, netSelfFinancingRatio: 0.031, dwellings: 4, vacancyRate: 0.25 }, RATIO_CONVENTIONS);
    expect(r.netSelfFinancing).toBe(0.031);
    expect(r.ebeOnRents).toBe(0.52);
    expect(r.debtService.annuities).toBe(850_000);
    expect(r.debtService.ratio).toBeCloseTo(0.5, 12);
    expect(r.financialChargesOnRents).toEqual({ charges: 425_000, rents: 1_700_000, ratio: 0.25 });
    expect(r.vacancy).toEqual({ rate: 0.25, dwellings: 4 });
    expect(r.arrears.ratio).toBe(0.1);
    expect(r.managementCost.perDwelling).toBe(137_500);
  });

  it('accepts other conventions', () => {
    const conv = { ...RATIO_CONVENTIONS, loanInterest: { include: ['661'] } };
    expect(debtService(balances, 0, 1, conv).interest).toBe(400_999);
  });

  it('ruleCovers applies the included and excluded prefixes', () => {
    const rule = { include: ['635', '64'], exclude: ['63512'] };
    expect(ruleCovers(rule, '6358')).toBe(true);
    expect(ruleCovers(rule, '6411')).toBe(true);
    expect(ruleCovers(rule, '63512')).toBe(false);
    expect(ruleCovers(rule, '615')).toBe(false);
    expect(ruleCovers({ include: ['704'] }, '70491')).toBe(true);
  });

  it('safeRatio returns null on a zero denominator', () => {
    expect(safeRatio(1, 0)).toBeNull();
    expect(safeRatio(1, 4)).toBe(0.25);
  });
});

describe('net self-financing series and three-year mean', () => {
  const history = [
    { year: 2021, netSelfFinancingRatioPct: 3.6 },
    { year: 2022, netSelfFinancingRatioPct: 3.3 },
    { year: 2023, netSelfFinancingRatioPct: 3.1 },
  ];
  const computed = [
    { year: 2025, ratio: 0.052 },
    { year: 2024, ratio: 0.026 },
  ];

  it('merges the history (percent) with the computed ratios, sorted by year', () => {
    const s = netSelfFinancingSeries(history, computed);
    expect(s.map((x) => x.year)).toEqual([2021, 2022, 2023, 2024, 2025]);
    expect(s[0]).toMatchObject({ year: 2021, source: 'history' });
    expect(s[0]!.ratio).toBeCloseTo(0.036, 12);
    expect(s[4]).toEqual({ year: 2025, ratio: 0.052, source: 'computed' });
  });

  it('lets a computed ratio replace the history of the same year', () => {
    const s = netSelfFinancingSeries([...history, { year: 2024, netSelfFinancingRatioPct: 9 }], computed);
    expect(s.find((x) => x.year === 2024)).toEqual({ year: 2024, ratio: 0.026, source: 'computed' });
  });

  it('averages the ratios of the three years ending with a year', () => {
    const s = netSelfFinancingSeries(history, computed);
    expect(trailingMean(s, 2025)).toBeCloseTo((0.031 + 0.026 + 0.052) / 3, 12);
    expect(trailingMean(s, 2023)).toBeCloseTo((0.036 + 0.033 + 0.031) / 3, 12);
    expect(trailingMean(s, 2022)).toBeNull();
    expect(trailingMean(s, 2025, 2)).toBeCloseTo(0.039, 12);
  });

  it('compares a ratio with a reference rate in percent', () => {
    expect(meetsReference(0.03, 3)).toBe(true);
    expect(meetsReference(0.036, 3)).toBe(true);
    expect(meetsReference(0.0299, 3)).toBe(false);
    expect(meetsReference(0, 0)).toBe(true);
    expect(meetsReference(-0.001, 0)).toBe(false);
  });
});

describe('Livret A time-weighted average rate', () => {
  const history = [
    { from: '2025-08-01', ratePct: 1.7 },
    { from: '2023-02-01', ratePct: 3.0 },
    { from: '2025-02-01', ratePct: 2.4 },
    { from: '2022-08-01', ratePct: 2.0 },
  ];

  it('weights each rate by the days it applies (unsorted history)', () => {
    const r = timeWeightedRate(history, 2025);
    expect(r.daysInYear).toBe(365);
    expect(r.coveredDays).toBe(365);
    expect(r.periods).toEqual([
      { from: '2025-01-01', to: '2025-01-31', days: 31, ratePct: 3.0 },
      { from: '2025-02-01', to: '2025-07-31', days: 181, ratePct: 2.4 },
      { from: '2025-08-01', to: '2025-12-31', days: 153, ratePct: 1.7 },
    ]);
    expect(r.averagePct).toBeCloseTo((31 * 3.0 + 181 * 2.4 + 153 * 1.7) / 365, 12);
  });

  it('handles a leap year with a single rate', () => {
    const r = timeWeightedRate(history, 2024);
    expect(r.daysInYear).toBe(366);
    expect(r.periods).toEqual([{ from: '2024-01-01', to: '2024-12-31', days: 366, ratePct: 3.0 }]);
    expect(r.averagePct).toBe(3.0);
  });

  it('averages over the covered days only when the history starts during the year', () => {
    const r = timeWeightedRate([{ from: '2025-07-01', ratePct: 2 }], 2025);
    expect(r.coveredDays).toBe(184);
    expect(r.averagePct).toBe(2);
    const none = timeWeightedRate([{ from: '2026-01-01', ratePct: 2 }], 2025);
    expect(none.periods).toEqual([]);
    expect(none.averagePct).toBeNull();
  });

  it('applies a rate changed on 1 January to the whole year', () => {
    const r = timeWeightedRate(
      [
        { from: '2024-01-01', ratePct: 1 },
        { from: '2025-01-01', ratePct: 2 },
      ],
      2025,
    );
    expect(r.periods).toEqual([{ from: '2025-01-01', to: '2025-12-31', days: 365, ratePct: 2 }]);
  });

  it('works on the parameterised history', () => {
    const h = loadParams().regulatory.livretA.history;
    for (const year of [2024, 2025]) {
      const r = timeWeightedRate(h, year);
      expect(r.coveredDays).toBe(r.daysInYear);
      const rates = r.periods.map((p) => p.ratePct);
      expect(r.averagePct!).toBeGreaterThanOrEqual(Math.min(...rates));
      expect(r.averagePct!).toBeLessThanOrEqual(Math.max(...rates));
    }
  });
});

describe('monthly rents from FEC lines', () => {
  const line = (JournalCode: string, CompteNum: string, EcritureDate: string, creditCents: number): MonthlyFecLine => ({ JournalCode, CompteNum, EcritureDate, creditCents });
  const lines = [
    line('AN', '70411', '20250101', 999_999), // opening entry: excluded
    line('QT', '70411', '20250101', 100_000),
    line('QT', '70412', '20250115', 20_000),
    line('QT', '70413', '20250101', 50_000), // not in the accounts asked
    line('QT', '70414', '20250201', 30_000),
    line('QT', '704111', '20250201', 5_000), // sub-account of a prefix
    line('OD', '70411', '20250331', 0), // debit line
    line('OD', '70415', '20251231', 7_000),
    line('QT', '411', '20250101', 100_000), // other account
    line('QT', '70411', '2025', 1_000), // unreadable date: ignored
  ];

  it('sums the credits by month of the entry date, opening entries excluded', () => {
    const m = monthlyCredits(lines, RATIO_CONVENTIONS.monthlyRents);
    expect(m).toHaveLength(12);
    expect(m[0]).toBe(120_000);
    expect(m[1]).toBe(35_000);
    expect(m[2]).toBe(0);
    expect(m[11]).toBe(7_000);
    expect(m.reduce((a, b) => a + b, 0)).toBe(162_000);
  });

  it('can exclude other journals', () => {
    const m = monthlyCredits(lines, RATIO_CONVENTIONS.monthlyRents, ['AN', 'OD']);
    expect(m[11]).toBe(0);
  });

  it('lists the rent accounts left out of the chart (credit accounts of the rents rule only)', () => {
    const chart = [
      { number: '70411', normalSide: 'credit' as const },
      { number: '70413', normalSide: 'credit' as const },
      { number: '70491', normalSide: 'debit' as const }, // RLS: not a rent
      { number: '7031', normalSide: 'credit' as const }, // charges: not a rent
      { number: '7088', normalSide: 'credit' as const },
    ];
    expect(rentAccountsLeftOut(chart, { include: ['704'] }, ['70411'])).toEqual(['70413']);
    expect(rentAccountsLeftOut(chart, { include: ['704'] }, ['704'])).toEqual([]);
  });

  it('leaves the residences billed separately out of the monthly chart', () => {
    expect(rentAccountsLeftOut(loadParams().chart.accounts, ANALYSIS.rents, RATIO_CONVENTIONS.monthlyRents)).toEqual(['70413']);
  });
});

describe('conventions', () => {
  it('every account prefix of the conventions exists in the chart of accounts', () => {
    const accounts = loadParams().chart.accounts.map((a) => a.number);
    const rules = [RATIO_CONVENTIONS.loanInterest, RATIO_CONVENTIONS.rentReceivables, RATIO_CONVENTIONS.billedRentsAndCharges, RATIO_CONVENTIONS.managementCost];
    const prefixes = [...rules.flatMap((r) => [...r.include, ...(r.exclude ?? [])]), ...RATIO_CONVENTIONS.monthlyRents, ...RATIO_CONVENTIONS.managementCost.leftOut.map((l) => l.prefix)];
    for (const p of prefixes)
      expect(
        accounts.some((a) => a.startsWith(p)),
        p,
      ).toBe(true);
  });
  it('monthly rents are rents, included in the rents and charges billed', () => {
    for (const a of RATIO_CONVENTIONS.monthlyRents) {
      expect(ruleCovers(ANALYSIS.rents, a), a).toBe(true);
      expect(ruleCovers(RATIO_CONVENTIONS.billedRentsAndCharges, a), a).toBe(true);
    }
  });
  it('rents and charges billed are net of the RLS and include the charges, like the receivables', () => {
    const accounts = loadParams().chart.accounts.map((a) => a.number);
    const rentAccounts = accounts.filter((a) => ruleCovers(ANALYSIS.rents, a));
    expect(rentAccounts.length).toBeGreaterThan(0);
    // every account of the net rents (RLS included) is in the denominator
    for (const a of rentAccounts) expect(ruleCovers(RATIO_CONVENTIONS.billedRentsAndCharges, a), a).toBe(true);
    expect(accounts.some((a) => ruleCovers(ANALYSIS.chargeRecoveries, a) && ruleCovers(RATIO_CONVENTIONS.billedRentsAndCharges, a))).toBe(true);
  });
  it('the accounts left out of the management cost are outside the rule, each with a reason', () => {
    const accounts = loadParams().chart.accounts.map((a) => a.number);
    const rule = RATIO_CONVENTIONS.managementCost;
    expect(rule.leftOut.length).toBeGreaterThan(0);
    for (const { prefix, reason } of rule.leftOut) {
      expect(reason.trim(), prefix).not.toBe('');
      expect(rule.include.some((p) => prefix.startsWith(p)), prefix).toBe(false);
      expect(accounts.some((a) => a.startsWith(prefix) && !ruleCovers(rule, a)), prefix).toBe(true);
    }
  });
});
