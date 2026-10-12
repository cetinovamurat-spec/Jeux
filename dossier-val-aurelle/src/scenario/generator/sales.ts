/**
 * HLM sales: the sold dwelling takes its share of the building's components and
 * of the programme land; the price is its book value plus a gain calibrated on
 * the yearly target of disposal gains.
 */
import { allocate, type Cents } from '../../engine/money';
import { accumulatedDepreciation } from '../../engine/subledgers/depreciation';
import type { AssetComponent } from '../../engine/types';
import { eur, type GenState } from './core';

function splitOff(st: GenState, c: AssetComponent, fraction: number, saleId: string, deedDate: string): AssetComponent {
  const cost = Math.round(c.cost * fraction);
  c.cost -= cost;
  const piece: AssetComponent = { ...c, id: `${c.id}-${saleId}`, cost, disposal: { date: deedDate, reason: 'sale', saleId } };
  delete (piece as { revisedPlan?: unknown }).revisedPlan;
  st.components.push(piece);
  return piece;
}

/** Book value of a set of components at the end of `date`. */
export function bookValue(components: readonly AssetComponent[], date: string): Cents {
  return components.reduce((s, c) => s + c.cost - accumulatedDepreciation(c, date), 0);
}

export function buildSales(st: GenState): void {
  const rng = st.rng.fork('sales');
  const remainingUnits = new Map<string, number>();
  for (const b of st.buildings) remainingUnits.set(b.id, b.units);
  const progUnits = new Map<string, number>();
  for (const p of st.programmes) progUnits.set(p.id, p.units);
  const ordered = [...st.sales].sort((a, b) => (a.deedDate < b.deedDate ? -1 : 1));
  for (const sale of ordered) {
    const dwelling = st.dwellings.find((d) => d.id === sale.dwellingIds[0])!;
    const b = dwelling.buildingId;
    const units = remainingUnits.get(b)!;
    const deedDay = sale.deedDate;
    const disposalDate = deedDay; // depreciation runs until the deed date
    const pieces: AssetComponent[] = [];
    for (const c of st.components.filter((x) => x.building === b && !x.disposal && x.inServiceDate <= deedDay)) {
      pieces.push(units <= 1 ? Object.assign(c, { disposal: { date: disposalDate, reason: 'sale' as const, saleId: sale.id } }) : splitOff(st, c, 1 / units, sale.id, disposalDate));
    }
    const land = st.components.find((x) => x.programmeId === sale.programmeId && x.family === 'land' && !x.disposal && !x.id.includes('-V'));
    const pu = progUnits.get(sale.programmeId)!;
    if (land && pu > 0) pieces.push(splitOff(st, land, 1 / pu, sale.id, disposalDate));
    remainingUnits.set(b, units - 1);
    progUnits.set(sale.programmeId, pu - 1);
    (sale as { componentIds: readonly string[] }).componentIds = pieces.map((p) => p.id);
    const lease = st.leases.find((l) => l.dwellingId === dwelling.id && l.endReason === 'sale');
    sale.buyer = lease ? lease.tenantName : `${rng.pick(['GARCIA', 'LAMBERT', 'ROCHE', 'VIDAL'])} ${rng.pick(['Julie', 'Marc', 'Anne', 'Paul'])}`;
  }
  // prices: book value + calibrated gain
  for (const year of [2024, 2025]) {
    const target = eur(st.params.calibration.clean[String(year)]!['disposalGains']!.value!);
    const sales = st.sales.filter((s) => s.deedDate.startsWith(`${year}-`));
    const gains = allocate(target, sales.map((s) => (st.progParams.get(s.programmeId)!.pavilions ? 1.25 : 1) * rng.uniform(0.85, 1.15)));
    sales.forEach((s, i) => {
      const comps = st.components.filter((c) => s.componentIds.includes(c.id));
      s.price = Math.round((bookValue(comps, s.deedDate) + gains[i]!) / 10000) * 10000;
    });
    // rounding of prices to the hundred euros: absorb the difference in the last sale
    const actual = sales.reduce((acc, s) => acc + s.price - bookValue(st.components.filter((c) => s.componentIds.includes(c.id)), s.deedDate), 0);
    const last = sales[sales.length - 1];
    if (last) last.price += target - actual;
  }
}

export function closFleuriBookValue(st: GenState): Cents {
  const sales = st.sales.filter((s) => s.deedDate.startsWith('2026-'));
  return sales.reduce((acc, s) => acc + bookValue(st.components.filter((c) => s.componentIds.includes(c.id)), '2025-12-31'), 0);
}
