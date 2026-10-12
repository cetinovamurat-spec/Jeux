/**
 * Money helpers. Amounts are integer euro cents (`Cents`); rounding happens
 * once, when an entry line is built (half away from zero).
 */
export type Cents = number;

/** Rounds a fractional number of cents to an integer, half away from zero. */
export function roundCents(value: number): Cents {
  const abs = Math.abs(value);
  // the epsilon absorbs binary noise such as 0.49999999997
  const rounded = Math.floor(abs + 0.5 + 1e-7);
  return value < 0 ? -rounded : rounded;
}

export function eurosToCents(euros: number): Cents {
  return roundCents(euros * 100);
}

export function centsToEuros(cents: Cents): number {
  return cents / 100;
}

export function sumCents(values: Iterable<Cents>): Cents {
  let total = 0;
  for (const v of values) total += v;
  return total;
}

/** amount × numerator / denominator, rounded to the cent. */
export function prorate(amount: Cents, numerator: number, denominator: number): Cents {
  if (denominator === 0) return 0;
  return roundCents((amount * numerator) / denominator);
}

/**
 * Splits `total` proportionally to `weights` with the largest-remainder method,
 * so that the parts always add up exactly to the total.
 */
export function allocate(total: Cents, weights: readonly number[]): Cents[] {
  const n = weights.length;
  if (n === 0) return [];
  const weightSum = weights.reduce((a, b) => a + b, 0);
  if (weightSum === 0) {
    const parts = new Array<Cents>(n).fill(0);
    parts[0] = total;
    return parts;
  }
  const sign = total < 0 ? -1 : 1;
  const abs = Math.abs(total);
  const exact = weights.map((w) => (abs * w) / weightSum);
  const floors = exact.map((x) => Math.floor(x + 1e-9));
  let remainder = abs - floors.reduce((a, b) => a + b, 0);
  const order = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x + 1e-9) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; remainder > 0 && k < order.length; k++, remainder--) {
    const idx = order[k]!.i;
    floors[idx] = floors[idx]! + 1;
  }
  return floors.map((x) => x * sign);
}
