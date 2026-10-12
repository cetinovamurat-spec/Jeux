/**
 * Deterministic pseudo-random generator (sfc32 seeded with xmur3).
 * `fork(name)` derives an independent stream, so adding a stream never shifts
 * the values drawn by the others.
 */
export interface Rng {
  readonly seed: string;
  /** Uniform in [0, 1). */
  next(): number;
  /** Integer in [min, max] (inclusive). */
  int(min: number, max: number): number;
  uniform(min: number, max: number): number;
  normal(mean: number, sd: number): number;
  /** Log-normal with the given median and dispersion (sigma of the underlying normal). */
  lognormal(median: number, sigma: number): number;
  chance(probability: number): boolean;
  pick<T>(items: readonly T[]): T;
  weightedPick<T>(items: readonly T[], weights: readonly number[]): T;
  shuffle<T>(items: readonly T[]): T[];
  fork(name: string): Rng;
}

function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function sfc32(a: number, b: number, c: number, d: number): () => number {
  return () => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

export function createRng(seed: string): Rng {
  const h = xmur3(seed);
  const raw = sfc32(h(), h(), h(), h());
  for (let i = 0; i < 12; i++) raw();
  let spareNormal: number | null = null;

  const rng: Rng = {
    seed,
    next: raw,
    int(min, max) {
      return min + Math.floor(raw() * (max - min + 1));
    },
    uniform(min, max) {
      return min + raw() * (max - min);
    },
    normal(mean, sd) {
      if (spareNormal !== null) {
        const z = spareNormal;
        spareNormal = null;
        return mean + sd * z;
      }
      let u = 0;
      let v = 0;
      while (u === 0) u = raw();
      while (v === 0) v = raw();
      const mag = Math.sqrt(-2 * Math.log(u));
      spareNormal = mag * Math.sin(2 * Math.PI * v);
      return mean + sd * mag * Math.cos(2 * Math.PI * v);
    },
    lognormal(median, sigma) {
      return median * Math.exp(rng.normal(0, sigma));
    },
    chance(probability) {
      return raw() < probability;
    },
    pick(items) {
      if (items.length === 0) throw new Error('pick on empty list');
      return items[Math.floor(raw() * items.length)]!;
    },
    weightedPick(items, weights) {
      const total = weights.reduce((a, b) => a + b, 0);
      let x = raw() * total;
      for (let i = 0; i < items.length; i++) {
        x -= weights[i]!;
        if (x < 0) return items[i]!;
      }
      return items[items.length - 1]!;
    },
    shuffle(items) {
      const copy = items.slice();
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(raw() * (i + 1));
        [copy[i], copy[j]] = [copy[j]!, copy[i]!];
      }
      return copy;
    },
    fork(name) {
      return createRng(`${seed}/${name}`);
    },
  };
  return rng;
}
