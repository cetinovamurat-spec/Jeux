import { describe, expect, it } from 'vitest';
import { allocate, roundCents, prorate } from '../../src/engine/money';
import { addMonths, daysBetween, formatDateFr } from '../../src/engine/dates';
import { formatAmount, formatFecAmount } from '../../src/engine/format';

describe('money', () => {
  it('rounds half away from zero', () => {
    expect(roundCents(0.5)).toBe(1);
    expect(roundCents(-0.5)).toBe(-1);
    expect(roundCents(1234.4999)).toBe(1234);
    expect(roundCents(1234.49999999)).toBe(1235); // binary noise around .5 rounds up
  });
  it('allocates with the largest remainder, exactly', () => {
    const parts = allocate(100, [1, 1, 1]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(100);
    expect(parts).toEqual([34, 33, 33]);
    expect(allocate(-100, [1, 1, 1]).reduce((a, b) => a + b, 0)).toBe(-100);
  });
  it('prorates', () => expect(prorate(4_200_000, 181, 365)).toBe(2_082_740));
});

describe('dates and formats', () => {
  it('counts days (prorata of the specification)', () => {
    expect(daysBetween('2025-07-01', '2026-01-01')).toBe(184);
    expect(daysBetween('2025-01-01', '2025-07-01')).toBe(181);
    expect(daysBetween('2025-07-01', '2028-01-01')).toBe(914);
    expect(daysBetween('2025-09-01', '2026-01-01')).toBe(122);
  });
  it('adds months with clamping', () => expect(addMonths('2025-01-31', 1)).toBe('2025-02-28'));
  it('formats fr-FR', () => {
    expect(formatDateFr('2025-12-31')).toBe('31/12/2025');
    expect(formatAmount(123456789).replace(/\s/g, ' ')).toBe('1 234 567,89');
    expect(formatFecAmount(30000000)).toBe('300000,00');
  });
});
