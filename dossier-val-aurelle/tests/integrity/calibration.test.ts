/** §4.3 targets for the clean accounts (J1) and the metrics the J2 anomalies rely on. */
import { describe, expect, it } from 'vitest';
import { calibrationRows } from '../../src/scenario/calibration';
import { params, world } from '../helpers/world';

describe('calibration of the clean world', () => {
  const rows = calibrationRows(world(), params());
  for (const row of rows) {
    it(`${row.year} – ${row.label}: ${row.valueText} (cible ${row.targetText})`, () => {
      expect(row.ok).toBe(true);
    });
  }
  it('PGE movements are exact', () => {
    const pge = world().state.pge.find((p) => p.year === 2025)!;
    expect(pge).toMatchObject({ opening: 740_000_000, dotation: 145_000_000, reprise: 189_000_000, closing: 696_000_000 });
  });
  it('volumes of the case (programmes, leases, loans, components, invoices)', () => {
    const s = world().state;
    expect(s.programmes).toHaveLength(40);
    expect(s.loans.length).toBeGreaterThanOrEqual(110);
    expect(s.loans.length).toBeLessThanOrEqual(130);
    expect(s.components.length).toBeGreaterThanOrEqual(3500);
    expect(s.invoices.filter((i) => i.serviceYear === 2025).length).toBeGreaterThanOrEqual(3500);
    const units2025 = s.dwellings.filter((d) => !s.sales.some((x) => x.deedDate <= '2025-12-31' && x.dwellingIds.includes(d.id))).length;
    expect(units2025).toBe(8600);
    const formers = s.tenants.filter((t) => t.byYear.y2025?.category === 'former' && t.byYear.y2025.balance > 0).length;
    expect(formers).toBeGreaterThan(1000);
    expect(formers).toBeLessThan(1500);
  });
});
