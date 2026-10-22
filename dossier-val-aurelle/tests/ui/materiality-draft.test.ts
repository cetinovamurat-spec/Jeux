/** Draft of the materiality calculator rebuilt from the decision in force (Planification > Seuils): same amount, rounding from params. */
import { describe, expect, it } from 'vitest';
import { materialityFrom, type MaterialityChoice } from '../../src/game/planning';
import { loadParams } from '../../src/scenario/params';
import { defaultRounding, draftFrom, emptyDraft, parseDecimal, roundingOf } from '../../src/ui/screens/planning/planningStore';

const params = loadParams();
const units = params.planning.thresholds.roundingEuros;
const EUR = 100;

function choice(baseAmount: number, pct: number, unit: number, over: Partial<MaterialityChoice> = {}): MaterialityChoice {
  return {
    base: params.planning.bases[0]!.id,
    vintage: 'certified2024',
    baseAmount,
    pct,
    amount: materialityFrom(baseAmount, pct, unit),
    planningPct: 75,
    trivialPct: 5,
    specificPct: null,
    factors: [],
    comment: '',
    on: '2025-11-14',
    ...over,
  };
}

/** Amount shown by the calculator for a draft on the same base. */
function redrawn(c: MaterialityChoice): number {
  const d = draftFrom(c, c.vintage, units);
  return materialityFrom(c.baseAmount, parseDecimal(d.pct), d.rounding);
}

describe('materiality draft', () => {
  it('takes the default rounding from params, not from a literal', () => {
    const d = emptyDraft('certified2024', units);
    expect(units).toContain(d.rounding);
    expect(d.rounding).toBe(defaultRounding(units));
    expect(d.rounding).toBeGreaterThan(0);
  });

  it('restores the rounding of the decision in force (reload, or new data at the final)', () => {
    // base × pct = 376 400 €: 376 000 € to the thousand, 380 000 € to ten thousand
    const coarsest = Math.max(...units);
    const c = choice(18_820_000 * EUR, 2, coarsest);
    expect(materialityFrom(c.baseAmount, c.pct, defaultRounding(units))).not.toBe(c.amount);
    expect(roundingOf(c, units)).toBe(coarsest);
    expect(redrawn(c)).toBe(c.amount);
  });

  it('rebuilds the amount in force for every rounding offered, percentages kept exactly', () => {
    for (const u of units) {
      for (const pct of [0.5, 1.234, 2, 1.875]) {
        const c = choice(2_345_678_912, pct, u, { planningPct: 62.5, trivialPct: 3.125, specificPct: 0.75 });
        const d = draftFrom(c, c.vintage, units);
        expect(redrawn(c)).toBe(c.amount);
        expect(parseDecimal(d.pct)).toBe(pct);
        expect(parseDecimal(d.planningPct)).toBe(62.5);
        expect(parseDecimal(d.trivialPct)).toBe(3.125);
        expect(parseDecimal(d.specificPct)).toBe(0.75);
      }
    }
  });
});
