/** Audit sampling (engine/sampling.ts): sizes, determinism, strata, monetary units, projection. */
import { describe, expect, it } from 'vitest';
import { drawMonetaryUnit, drawRandom, drawStratified, drawSystematic, projectMisstatement, sampleSize, type SamplingItem } from '../../src/engine/sampling';

const items: SamplingItem[] = Array.from({ length: 200 }, (_, i) => ({ key: `k${String(i).padStart(3, '0')}`, amount: ((i * 7919) % 1000) * 100 + 100 }));

describe('sample size', () => {
  const base = { populationValue: 10_000_000_00, populationSize: 500, tolerable: 375_000_00, confidenceFactor: 2.3, expectedMisstatement: 37_500_00, expansionFactor: 1.6, min: 10, max: 60 };
  it('value × confidence / (tolerable − expected × expansion), rounded up', () => {
    // 2 300 000 000 / 31 500 000 = 73.02 → 74 (within the bounds once the maximum is raised)
    expect(sampleSize({ ...base, max: 100 })).toBe(Math.ceil((10_000_000_00 * 2.3) / (375_000_00 - 37_500_00 * 1.6)));
  });
  it('bounded by the minimum, the maximum and the population', () => {
    expect(sampleSize({ ...base, populationValue: 100_00 })).toBe(10);
    expect(sampleSize({ ...base, populationValue: 1_000_000_000_00 })).toBe(60);
    expect(sampleSize({ ...base, populationSize: 7 })).toBe(7);
    expect(sampleSize({ ...base, expectedMisstatement: 375_000_00 })).toBe(60);
    expect(sampleSize({ ...base, populationSize: 0 })).toBe(0);
  });
  it('a higher risk or deficient controls give a larger sample', () => {
    expect(sampleSize({ ...base, confidenceFactor: 3 })).toBeGreaterThan(sampleSize({ ...base, confidenceFactor: 1.6 }));
  });
});

describe('draws', () => {
  it('are deterministic for a seed and differ between seeds', () => {
    expect(drawRandom(items, 20, 's1')).toEqual(drawRandom(items, 20, 's1'));
    expect(drawRandom(items, 20, 's1')).not.toEqual(drawRandom(items, 20, 's2'));
    expect(drawSystematic(items, 20, 's1')).toEqual(drawSystematic(items, 20, 's1'));
    expect(drawMonetaryUnit(items, 20, 's1')).toEqual(drawMonetaryUnit(items, 20, 's1'));
    expect(drawStratified(items, 20, 3, 's1')).toEqual(drawStratified(items, 20, 3, 's1'));
  });
  it('random: n distinct keys, in the canonical order of the population', () => {
    const keys = drawRandom(items, 25, 'x');
    expect(new Set(keys).size).toBe(25);
    expect([...keys].sort()).toEqual(keys);
    expect(drawRandom(items, 500, 'x')).toHaveLength(items.length);
  });
  it('systematic: n items one interval apart', () => {
    const keys = drawSystematic(items, 20, 'x');
    expect(keys).toHaveLength(20);
    const idx = keys.map((k) => items.findIndex((i) => i.key === k));
    for (let i = 1; i < idx.length; i++) expect(idx[i]! - idx[i - 1]!).toBeGreaterThanOrEqual(9);
  });
  it('stratified: strata of comparable value, each one drawn', () => {
    const r = drawStratified(items, 30, 3, 'x');
    expect(r.strata).toHaveLength(3);
    for (const s of r.strata) expect(s.drawn).toBeGreaterThanOrEqual(1);
    expect(r.keys.length).toBe(r.strata.reduce((a, s) => a + s.drawn, 0));
    const total = r.strata.reduce((a, s) => a + s.value, 0);
    for (const s of r.strata) expect(s.value / total).toBeGreaterThan(0.2);
    expect(r.strata[0]!.to).toBeLessThanOrEqual(r.strata[1]!.from);
  });
  it('monetary units: top stratum at 100 %, negative items excluded, no duplicate', () => {
    const pop: SamplingItem[] = [...items, { key: 'big1', amount: 50_000_000 }, { key: 'big2', amount: 30_000_000 }, { key: 'neg', amount: -5_000_000 }, { key: 'nil', amount: 0 }];
    for (const seed of ['a', 'b', 'c', 'd']) {
      const r = drawMonetaryUnit(pop, 25, seed);
      expect(r.topStratum).toEqual(expect.arrayContaining(['big1', 'big2']));
      expect(r.keys).toEqual(expect.arrayContaining(['big1', 'big2']));
      expect(r.keys).not.toContain('neg');
      expect(r.keys).not.toContain('nil');
      expect(new Set(r.keys).size).toBe(r.keys.length);
      expect(r.keys.length).toBeLessThanOrEqual(25);
      expect(r.interval).toBeCloseTo(r.populationValue / 25, 6);
    }
  });
  it('monetary units: the probability of selection grows with the amount', () => {
    let small = 0;
    let large = 0;
    const pop: SamplingItem[] = Array.from({ length: 100 }, (_, i) => ({ key: `p${i}`, amount: i < 50 ? 1_000 : 100_000 }));
    for (let s = 0; s < 40; s++) {
      const keys = new Set(drawMonetaryUnit(pop, 10, `seed${s}`).keys);
      for (let i = 0; i < 100; i++) if (keys.has(`p${i}`)) (i < 50 ? small++ : large++);
    }
    expect(large).toBeGreaterThan(small * 10);
  });
});

describe('projection', () => {
  it('specific items: the misstatements found', () => {
    expect(projectMisstatement({ method: 'specific', results: [{ key: 'a', amount: 1000, misstatement: 100 }], populationValue: 1_000_000 })).toBe(100);
  });
  it('monetary units: top stratum actual, tainting × interval for the others', () => {
    const r = projectMisstatement({
      method: 'monetaryUnit',
      results: [
        { key: 'top', amount: 500_000, misstatement: 200_000 },
        { key: 'x', amount: 10_000, misstatement: 2_500 },
        { key: 'y', amount: 20_000, misstatement: 0 },
      ],
      populationValue: 5_000_000,
      interval: 100_000,
      topStratum: ['top'],
    });
    expect(r).toBe(200_000 + 25_000);
  });
  it('random: ratio of the misstatements to the value tested', () => {
    expect(projectMisstatement({ method: 'random', results: [{ key: 'a', amount: 10_000, misstatement: 1_000 }, { key: 'b', amount: 30_000, misstatement: 0 }], populationValue: 400_000 })).toBe(10_000);
  });
});
