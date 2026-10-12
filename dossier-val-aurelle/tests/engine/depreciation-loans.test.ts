import { describe, expect, it } from 'vitest';
import { accumulatedDepreciation, accumulatedSubsidyRelease, depreciationCharge } from '../../src/engine/subledgers/depreciation';
import { accruedInterest, buildSchedule } from '../../src/engine/subledgers/loans';
import type { AssetComponent, Loan, Subsidy } from '../../src/engine/types';

const comp = (c: Partial<AssetComponent>): AssetComponent => ({ id: 'c', programmeId: 'P', building: 'P-B01', family: 'heating', label: '', operationId: 'op', account: '2131', cost: 105_000_000, inServiceDate: '2008-01-01', usefulLifeYears: 25, ...c });

describe('depreciation (figures of the specification)', () => {
  it('A02 – boiler: 42 k€ a year, NBV 336 k€ at 31/12/2024, 20,8 k€ until 30/06/2025', () => {
    const c = comp({});
    expect(depreciationCharge(c, '2024-01-01', '2024-12-31')).toBe(4_200_000);
    expect(c.cost - accumulatedDepreciation(c, '2024-12-31')).toBe(33_600_000);
    expect(depreciationCharge(c, '2025-01-01', '2025-06-30')).toBe(2_082_740);
  });
  it('A01 – component in service on 01/07/2025: 184/365 of a year', () => {
    const c = comp({ cost: 100_000_000, inServiceDate: '2025-07-01', usefulLifeYears: 50 });
    expect(accumulatedDepreciation(c, '2025-12-31')).toBe(Math.round((100_000_000 / 50) * (184 / 365)));
  });
  it('A04 – revised plan: net book value over 914 days', () => {
    const c = comp({ cost: 360_000_000, inServiceDate: '2015-07-01', usefulLifeYears: 30, revisedPlan: { from: '2025-07-01', until: '2027-12-31' } });
    const nbv = c.cost - accumulatedDepreciation(c, '2025-06-30');
    expect(nbv).toBe(240_000_000);
    expect(depreciationCharge(c, '2025-07-01', '2025-12-31')).toBe(Math.round((240_000_000 * 184) / 914));
    expect(accumulatedDepreciation(c, '2027-12-31')).toBe(c.cost);
  });
  it('releases subsidies at the pace of depreciation, fully on disposal', () => {
    const c = comp({ cost: 100_000_000, inServiceDate: '2020-01-01', usefulLifeYears: 20 });
    const s: Subsidy = { id: 's', operationId: 'op', programmeId: 'P', grantorId: 'ETAT', account: '1311', amount: 20_000_000, decisionDate: '2019-01-01', receipts: [] };
    expect(accumulatedSubsidyRelease(s, [c], '2024-12-31')).toBe(5_000_000);
    const sold = { ...c, disposal: { date: '2025-03-31', reason: 'sale' as const } };
    expect(accumulatedSubsidyRelease(s, [sold], '2025-12-31')).toBe(20_000_000);
  });
});

describe('loans', () => {
  const history = [
    { from: '2023-02-01', ratePct: 3 },
    { from: '2025-02-01', ratePct: 2.4 },
    { from: '2025-08-01', ratePct: 1.7 },
  ];
  const loan: Loan = { id: 'L', lenderId: 'BDT', product: 'PLUS', activity: 'rental', account: '1631', contractNumber: '1', principal: 100_000_000, startDate: '2020-03-01', refDate: '2024-03-01', refOutstanding: 100_000_000, remainingPeriods: 30, periodMonths: 12, nextDueDate: '2025-03-01', rate: { kind: 'livretA', marginPct: 0.6, floorPct: 0 }, amortisation: 'annuity' };
  it('revises the rate at each due date (Livret A at the period start + margin)', () => {
    const s = buildSchedule(loan, history, '2027-12-31');
    expect(s[0]!.ratePct).toBeCloseTo(3.6);
    expect(s[1]!.ratePct).toBeCloseTo(3.0);
    expect(s[0]!.interest).toBe(Math.round((100_000_000 * 3.6 * 365) / 36500));
  });
  it('computes accrued interest at the own rate and at a flat rate', () => {
    const s = buildSchedule(loan, history, '2027-12-31');
    const own = accruedInterest(loan, s, '2025-12-31');
    const flat = accruedInterest(loan, s, '2025-12-31', 3.0);
    expect(own).toBe(Math.round((s[0]!.outstandingAfter * 3.0 * 306) / 36500));
    expect(flat).toBe(own);
  });
});
