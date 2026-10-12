/** §5 — impacts computed from the correction entries vs the catalogue; §4.3 presented targets. */
import { describe, expect, it } from 'vitest';
import { presentedRows } from '../../src/scenario/calibration';
import { checkTarget } from '../../src/scenario/anomalies/synthesis';
import type { Target } from '../../src/scenario/schema';
import { correctionKey, synthesis } from '../helpers/scenario';
import { params } from '../helpers/world';

const euros = (c: number) => c / 100;

describe('impacts of the anomalies (§5)', () => {
  const s = synthesis();
  const t = params().calibration.impacts as Record<string, Target>;
  for (const a of s.anomalies) {
    it(`${a.id} – ${a.title}: result impact ${euros(a.impact.result).toFixed(2)} €`, () => {
      expect(a.target, `cible manquante pour ${a.id}`).toBeDefined();
      expect(checkTarget(euros(a.impact.result), a.target!), JSON.stringify(a.target)).toBe(true);
      if (a.equityTarget) expect(checkTarget(euros(a.impact.equity), a.equityTarget)).toBe(true);
    });
  }
  it('reference synthesis: overstatements, understatement, corrected result', () => {
    expect(checkTarget(euros(s.overstatements), t['overstatements']!)).toBe(true);
    expect(checkTarget(euros(s.understatements), t['understatements']!)).toBe(true);
    expect(checkTarget(euros(s.correctedResult), t['netResultCorrected']!)).toBe(true);
    expect(s.presentedResult - s.correctedResult).toBe(s.overstatements + s.understatements);
  });
  it('net self-financing: overstatement and ratios presented / corrected, three-year averages', () => {
    expect(checkTarget(euros(s.netSelfFinancingOverstatement), t['netSelfFinancingOverstatement']!)).toBe(true);
    expect(checkTarget(s.correctedRatio * 100, t['netSelfFinancingRatioCorrectedPct']!)).toBe(true);
    expect(checkTarget(s.threeYearCorrected * 100, t['threeYearAverageCorrectedPct']!)).toBe(true);
    expect(checkTarget(s.threeYearPresented * 100, t['threeYearAveragePresentedPct']!)).toBe(true);
    // presented accounts pass the reference rates, corrected accounts do not (three-year average)
    expect(s.threeYearPresented).toBeGreaterThanOrEqual(s.referenceRates.threeYears);
    expect(s.threeYearCorrected).toBeLessThan(s.referenceRates.threeYears);
  });
  it('individually significant anomalies: A03, A05, A07; A15 between the performance and overall thresholds', () => {
    expect(s.aboveOverall.sort()).toEqual(['A03', 'A05', 'A07']);
    expect(s.betweenPerformanceAndOverall).toContain('A15');
  });
  it('presented accounts meet the §4.3 targets', () => {
    const failing = presentedRows(correctionKey(), params()).filter((r) => !r.ok).map((r) => `${r.label}: ${r.valueText} (cible ${r.targetText})`);
    expect(failing).toEqual([]);
  });
  it('A07-a lies within the tolerance accepted for a rate based on recovery history', () => {
    const a = correctionKey().corrections.find((c) => c.key === 'A07.a')!;
    const tol = a.part.tolerance!;
    expect(euros(a.impact.result)).toBeGreaterThanOrEqual(tol.minEuros);
    expect(euros(a.impact.result)).toBeLessThanOrEqual(tol.maxEuros);
  });
  it('parts without accounting effect have no correction entry', () => {
    for (const c of correctionKey().corrections) {
      if (['disclose', 'report', 'specialReport', 'governance'].includes(c.part.treatment)) expect(c.entry, c.key).toBeNull();
      if (c.part.treatment === 'adjust') expect(c.entry, c.key).not.toBeNull();
    }
  });
});
