/**
 * Audit sampling (plan J4 §10): sample size of a test of details, draws
 * (specific items, random, systematic, stratified, monetary unit) and the
 * projection of the misstatements found. Pure, deterministic: every draw is
 * seeded (engine/rng); items keep their canonical order and are identified by
 * a short key. Amounts in cents.
 */
import type { Cents } from './money';
import { createRng } from './rng';

export interface SamplingItem {
  key: string;
  /** Book value of the item (cents). Monetary-unit sampling ignores items ≤ 0. */
  amount: Cents;
}

export type SamplingMethod = 'specific' | 'random' | 'systematic' | 'stratified' | 'monetaryUnit';

// ---------------------------------------------------------------------------
// size
// ---------------------------------------------------------------------------

export interface SizeInput {
  /** Value of the population (sum of the positive items). */
  populationValue: Cents;
  /** Number of items of the population. */
  populationSize: number;
  /** Tolerable misstatement (planning materiality). */
  tolerable: Cents;
  /** Confidence factor (assessed risk, reliance on controls). */
  confidenceFactor: number;
  /** Expected misstatement and its expansion factor. */
  expectedMisstatement: Cents;
  expansionFactor: number;
  min: number;
  max: number;
}

/**
 * n = population value × confidence factor / (tolerable − expected × expansion),
 * rounded up, within [min, max] and never more than the population. When the
 * expected misstatement absorbs the tolerable one, the maximum size applies.
 */
export function sampleSize(i: SizeInput): number {
  if (i.populationSize <= 0) return 0;
  const room = i.tolerable - i.expectedMisstatement * i.expansionFactor;
  const raw = room <= 0 ? i.max : Math.ceil((i.populationValue * i.confidenceFactor) / room - 1e-9);
  return Math.min(i.populationSize, Math.max(i.min, Math.min(i.max, raw)));
}

// ---------------------------------------------------------------------------
// draws (keys returned in the canonical order of the population)
// ---------------------------------------------------------------------------

function inOrder(items: readonly SamplingItem[], picked: ReadonlySet<string>): string[] {
  return items.filter((x) => picked.has(x.key)).map((x) => x.key);
}

/** Simple random selection without replacement. */
export function drawRandom(items: readonly SamplingItem[], n: number, seed: string): string[] {
  const rng = createRng(`random:${seed}`);
  const picked = new Set(rng.shuffle(items.map((x) => x.key)).slice(0, Math.max(0, n)));
  return inOrder(items, picked);
}

/** Systematic selection: every k-th item (k = N / n) from a random start. */
export function drawSystematic(items: readonly SamplingItem[], n: number, seed: string): string[] {
  const N = items.length;
  if (n <= 0 || N === 0) return [];
  if (n >= N) return items.map((x) => x.key);
  const step = N / n;
  const start = createRng(`systematic:${seed}`).next() * step;
  const picked = new Set<string>();
  for (let k = 0; k < n; k++) picked.add(items[Math.min(N - 1, Math.floor(start + k * step))]!.key);
  return inOrder(items, picked);
}

export interface Stratum {
  /** Bounds of the book values of the stratum (cents, inclusive). */
  from: Cents;
  to: Cents;
  count: number;
  value: Cents;
  drawn: number;
}

/**
 * Stratified selection: the items, sorted by value, are cut into `strata`
 * strata of equal total value; the size is allocated in proportion to the
 * value of each stratum (at least one item), and each stratum is drawn at
 * random.
 */
export function drawStratified(items: readonly SamplingItem[], n: number, strata: number, seed: string): { keys: string[]; strata: Stratum[] } {
  const sorted = [...items].sort((a, b) => a.amount - b.amount || (a.key < b.key ? -1 : 1));
  const total = sorted.reduce((s, x) => s + Math.max(0, x.amount), 0);
  const groups: SamplingItem[][] = Array.from({ length: Math.max(1, strata) }, () => []);
  let cum = 0;
  for (const x of sorted) {
    const g = total > 0 ? Math.min(groups.length - 1, Math.floor((cum / total) * groups.length)) : 0;
    groups[g]!.push(x);
    cum += Math.max(0, x.amount);
  }
  const nonEmpty = groups.filter((g) => g.length > 0);
  const values = nonEmpty.map((g) => g.reduce((s, x) => s + Math.max(0, x.amount), 0));
  const alloc = nonEmpty.map((g, i) => Math.min(g.length, Math.max(1, total > 0 ? Math.round((n * values[i]!) / total) : Math.round(n / nonEmpty.length))));
  const picked = new Set<string>();
  const out: Stratum[] = [];
  nonEmpty.forEach((g, i) => {
    for (const k of drawRandom(g, alloc[i]!, `${seed}/stratum-${i + 1}`)) picked.add(k);
    out.push({ from: g[0]!.amount, to: g[g.length - 1]!.amount, count: g.length, value: values[i]!, drawn: alloc[i]! });
  });
  return { keys: inOrder(items, picked), strata: out };
}

export interface MonetaryUnitDraw {
  keys: string[];
  /** Sampling interval (population value / size). */
  interval: number;
  /** Items at least equal to the interval: tested at 100 %. */
  topStratum: string[];
  /** Positive value of the population. */
  populationValue: Cents;
}

/**
 * Monetary-unit sampling: interval J = value of the positive items / n; the
 * items ≥ J form the top stratum (all selected); the others are selected by
 * the monetary units hit every J from a random start (an item hit twice
 * counts once). Negative and nil items are excluded.
 */
export function drawMonetaryUnit(items: readonly SamplingItem[], n: number, seed: string): MonetaryUnitDraw {
  const positive = items.filter((x) => x.amount > 0);
  const value = positive.reduce((s, x) => s + x.amount, 0);
  if (n <= 0 || value === 0) return { keys: [], interval: 0, topStratum: [], populationValue: value };
  const interval = value / n;
  const top = positive.filter((x) => x.amount >= interval);
  const rest = positive.filter((x) => x.amount < interval);
  const picked = new Set(top.map((x) => x.key));
  const start = createRng(`mus:${seed}`).next() * interval;
  let cum = 0;
  let hit = start;
  for (const x of rest) {
    cum += x.amount;
    while (hit < cum) {
      picked.add(x.key);
      hit += interval;
    }
  }
  return { keys: inOrder(items, picked), interval, topStratum: top.map((x) => x.key), populationValue: value };
}

// ---------------------------------------------------------------------------
// projection
// ---------------------------------------------------------------------------

export interface ItemResult {
  key: string;
  /** Book value of the item. */
  amount: Cents;
  /** Misstatement found on the item (overstatement positive), 0 when none. */
  misstatement: Cents;
}

export interface ProjectionInput {
  method: SamplingMethod;
  results: readonly ItemResult[];
  /** Value of the population (positive items). */
  populationValue: Cents;
  /** Monetary-unit sampling: interval and top stratum. */
  interval?: number;
  topStratum?: readonly string[];
}

/**
 * Projected misstatement of the population:
 * - specific items: the misstatements found (no extrapolation);
 * - monetary units: actual misstatements of the top stratum + Σ tainting × interval for the others;
 * - random, systematic, stratified: ratio of the misstatements to the value tested, applied to the population.
 */
export function projectMisstatement(p: ProjectionInput): Cents {
  const found = p.results.reduce((s, r) => s + r.misstatement, 0);
  switch (p.method) {
    case 'specific':
      return found;
    case 'monetaryUnit': {
      const top = new Set(p.topStratum ?? []);
      let s = 0;
      for (const r of p.results) {
        if (!r.misstatement) continue;
        if (top.has(r.key) || r.amount <= 0) s += r.misstatement;
        else s += (Math.min(r.misstatement, r.amount) / r.amount) * (p.interval ?? 0);
      }
      return Math.round(s);
    }
    default: {
      const tested = p.results.reduce((s, r) => s + Math.max(0, r.amount), 0);
      return tested > 0 ? Math.round((found / tested) * p.populationValue) : 0;
    }
  }
}
