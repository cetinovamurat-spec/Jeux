/**
 * Table of misstatements (plan J4 §13.3): built from the findings « constat »
 * (never « question », « écarté » nor « clos »), every entry applied at once
 * (CAF and net self-financing ratio corrected), over- and understatements
 * separated, trivial items listed and not cumulated (a balance-sheet amount
 * above the threshold is never trivial), individually significant items
 * flagged, thresholds of the player; the key's own correction entries
 * reproduce the corrected accounts.
 */
import { describe, expect, it } from 'vitest';
import type { Finding } from '../../src/game/findings';
import { misstatementTable, presentedFigures } from '../../src/game/misstatements';
import { initialPlanning, type PlanningState } from '../../src/game/planning';
import { correctionKey } from '../helpers/scenario';
import { params } from '../helpers/world';

const P = params();
const key = correctionKey();
const world = key.presented.world;
const EUR = 100;

let n = 0;
function finding(lines: [string, number, number][], status: Finding['status'] = 'finding', over: Partial<Finding> = {}): Finding {
  n++;
  return {
    id: `M${n}`,
    title: `Constat ${n}`,
    cycle: 'crossCycle',
    objects: [],
    natures: [],
    classification: 'factual',
    treatments: ['adjust'],
    proposedEntry: lines.map(([account, d, c]) => ({ account, debit: Math.round(d * EUR), credit: Math.round(c * EUR) })),
    disclosureFix: null,
    evidence: [],
    status,
    history: [{ on: '2026-03-02', status }],
    escalatedToPartnerOn: null,
    comment: '',
    createdOn: '2026-03-02',
    ...over,
  };
}

const planning: PlanningState = {
  ...initialPlanning(),
  materiality: [{ base: 'rents', vintage: 'draft2025', baseAmount: 0, pct: 1.25, amount: 580_000 * EUR, planningPct: 65, trivialPct: 5, specificPct: null, factors: [], comment: '', on: '2026-02-24' }],
};

const a11 = finding([
  ['7088', 300_000, 0],
  ['4687', 0, 300_000],
]);
const a08 = finding([
  ['1688', 236_000, 0],
  ['6611', 0, 236_000],
]);
const a03 = finding([
  ['7752', 1_060_000, 0],
  ['462', 0, 1_060_000],
  ['2131', 289_500, 0],
  ['6752', 0, 289_500],
]);
const trivial = finding([
  ['6281', 10_000, 0],
  ['4081', 0, 10_000],
]);
const reclass = finding(
  [
    ['471', 2_500_000, 0],
    ['1631', 0, 2_500_000],
  ],
  'finding',
  { treatments: ['reclassify'] },
);
const disclosure = finding([], 'finding', { treatments: ['disclose'], disclosureFix: 'add-missing' });
const question = finding([
  ['6281', 500_000, 0],
  ['4081', 0, 500_000],
], 'question');
const closed = finding([
  ['6281', 184_000, 0],
  ['4081', 0, 184_000],
], 'closed');
const dismissed = finding([
  ['6281', 184_000, 0],
  ['4081', 0, 184_000],
], 'dismissed');

describe('table of misstatements', () => {
  const t = misstatementTable([a11, a08, a03, trivial, reclass, disclosure, question, closed, dismissed], { world, params: P, planning });

  it('keeps the findings « constat » only (not « question », « clos » nor « écarté »), one row each, without correction status (J6)', () => {
    expect(t.rows.map((r) => r.findingId)).toEqual([a11.id, a08.id, a03.id, trivial.id, reclass.id, disclosure.id]);
    expect(t.rows.every((r) => r.correctionStatus === null)).toBe(true);
  });

  it('derives the impacts from the entries: over- and understatements separated, reclassification and disclosure without result effect', () => {
    const row = (f: Finding) => t.rows.find((r) => r.findingId === f.id)!;
    expect(row(a11)).toMatchObject({ direction: 'over', quantified: true });
    expect(row(a11).impact.result).toBe(300_000 * EUR);
    expect(row(a11).impact.caf).toBe(300_000 * EUR);
    expect(row(a08).direction).toBe('under');
    expect(row(a08).impact.result).toBe(-236_000 * EUR);
    expect(row(a03).impact.result).toBe(770_500 * EUR);
    expect(row(a03).impact.caf).toBe(0);
    expect(row(reclass)).toMatchObject({ direction: 'none', amount: 2_500_000 * EUR });
    expect(row(reclass).impact.result).toBe(0);
    expect(row(disclosure)).toMatchObject({ direction: 'none', quantified: false, belowTrivial: false });
  });

  it('lists the items below the clearly trivial threshold without cumulating them; flags the individually significant ones', () => {
    const row = (f: Finding) => t.rows.find((r) => r.findingId === f.id)!;
    expect(row(trivial).belowTrivial).toBe(true);
    expect(t.trivialTotal).toBe(10_000 * EUR);
    expect(t.overstatements).toBe((300_000 + 770_500) * EUR);
    expect(t.understatements).toBe(-236_000 * EUR);
    expect(t.net).toBe((300_000 + 770_500 - 236_000) * EUR);
    expect(row(a03).individuallySignificant).toBe(true);
    expect(row(a11).individuallySignificant).toBe(false);
    expect(row(reclass).belowTrivial).toBe(false);
    expect(t.thresholds).toMatchObject({ materiality: 580_000 * EUR, planning: 377_000 * EUR, trivial: 29_000 * EUR });
    expect(t.comparison).toEqual({ aboveMateriality: true, abovePlanning: true, aboveTrivial: true });
  });

  it('applies all the entries at once (trivial ones included) for the corrected result, CAF and ratio', () => {
    expect(t.combined.result).toBe((300_000 + 770_500 - 236_000 + 10_000) * EUR);
    expect(t.corrected.result).toBe(t.presented.result - t.combined.result);
    expect(t.corrected.caf).toBe(t.presented.caf - (300_000 - 236_000 + 10_000) * EUR);
    expect(t.corrected.ratio).toBeLessThan(t.presented.ratio);
    expect(t.threeYear.corrected).toBeCloseTo((t.threeYear.ratio2023 + t.threeYear.ratio2024 + t.corrected.ratio) / 3, 12);
    expect(t.referenceRates.threeYears).toBe(P.regulatory.netSelfFinancing.referenceRate3YearsPct / 100);
  });

  it('a balance-sheet misstatement stays out of « insignifiante » when its entry also carries a small result effect (A16.a with its depreciation)', () => {
    const bare = finding([
      ['2131', 210_000, 0],
      ['4084', 0, 210_000],
    ]);
    const complete = finding([
      ['2131', 210_000, 0],
      ['4084', 0, 210_000],
      ['68111', 2_985, 0],
      ['28131', 0, 2_985],
    ]);
    const u = misstatementTable([bare, complete], { world, params: P, planning });
    expect(u.rows.map((r) => r.belowTrivial)).toEqual([false, false]);
    expect(u.rows[1]!.impact.result).toBe(2_985 * EUR);
    expect(u.trivialTotal).toBe(0);
    expect(u.overstatements).toBe(2_985 * EUR);
  });

  it('without a validated materiality: no threshold, nothing classed trivial nor significant', () => {
    const u = misstatementTable([a11, trivial], { world, params: P, planning: initialPlanning() });
    expect(u.thresholds).toBeNull();
    expect(u.comparison).toBeNull();
    expect(u.rows.some((r) => r.belowTrivial || r.individuallySignificant)).toBe(false);
    expect(u.net).toBe(310_000 * EUR);
  });

  it('the key’s own correction entries, as findings, reproduce the corrected accounts (result, CAF, ratio below the reference rate)', () => {
    const fs = key.corrections.filter((c) => c.entry).map((c) => finding(c.entry!.lines.map((l) => [l.account, l.debit / EUR, l.credit / EUR] as [string, number, number])));
    const all = misstatementTable(fs, { world, params: P, planning });
    expect(all.corrected.result).toBe(key.cleanFigures.figures.netResult);
    expect(all.corrected.caf).toBe(key.cleanFigures.figures.caf);
    expect(all.corrected.ratio).toBeCloseTo(key.cleanFigures.figures.netSelfFinancingRatio, 6);
    expect(all.threeYear.corrected).toBeLessThan(all.referenceRates.threeYears);
    expect(all.threeYear.presented).toBeGreaterThanOrEqual(all.referenceRates.threeYears);
    expect(presentedFigures(world, P)).toBe(presentedFigures(world, P));
  });
});
