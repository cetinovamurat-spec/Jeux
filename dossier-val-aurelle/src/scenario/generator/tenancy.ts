/**
 * Leases (monthly occupancy 2024–2025), rent roll, tenant accounts of the
 * property-management software (LOGIGES) and planned sales.
 */
import { addDays, endOfMonth, isoDate } from '../../engine/dates';
import { allocate, type Cents } from '../../engine/money';
import type { Rng } from '../../engine/rng';
import type { Dwelling, Lease, Sale, TenantAccount, TenantCategory } from '../datasets';
import { closFleuri2026Buildings } from './portfolio';
import { eur, type GenState } from './core';

const FIRST = ['Amine', 'Camille', 'Nadia', 'Julien', 'Sophie', 'Karim', 'Léa', 'Thomas', 'Fatou', 'Nicolas', 'Inès', 'Mathieu', 'Sarah', 'David', 'Aïcha', 'Pierre', 'Chloé', 'Mehdi', 'Laura', 'Antoine', 'Yasmine', 'Hugo', 'Manon', 'Rachid', 'Émilie', 'Kevin', 'Sandrine', 'Moussa', 'Céline', 'Olivier', 'Nora', 'Bruno', 'Marie', 'Youssef', 'Patricia', 'Stéphane', 'Awa', 'Christophe', 'Hélène', 'Samir'];
const LAST = ['Martin', 'Bernard', 'Diallo', 'Petitjean', 'Rousseau', 'Benali', 'Lefèvre', 'Morel', 'Traoré', 'Girardot', 'Bonnet', 'Mansouri', 'Fournier', 'Leroy', 'Nguyen', 'Garnier', 'Chevalier', 'Haddouche', 'Blanc', 'Guerin', 'Faure', 'Mercier', 'Lambertin', 'Dumont', 'Kone', 'Robin', 'Masson', 'Ouali', 'Henry', 'Roussel', 'Perrin', 'Marchal', 'Brun', 'Gauthier', 'Cissé', 'Picard', 'Renaud', 'Barbier', 'Arnaud', 'Rolland'];

export interface RentRollMonth {
  rentsRegulated: Cents;
  rentsOther: Cents;
  commercial: Cents;
  parking: Cents;
  rls: Cents;
  chargeProvisions: Cents;
  apl: Cents;
  newDeposits: Cents;
  occupiedUnits: number;
  units: number;
}

/** rentRoll[programmeId][year][month 1..12] */
export type RentRoll = Map<string, Map<number, RentRollMonth[]>>;

function monthStart(year: number, month: number): string {
  return isoDate(year, month, 1);
}

function activeIn(lease: Lease, year: number, month: number): boolean {
  return lease.start <= monthStart(year, month) && (!lease.end || lease.end >= endOfMonth(year, month));
}

// ---------------------------------------------------------------------------
// Sales planning
// ---------------------------------------------------------------------------

export function planSales(st: GenState): void {
  const rng = st.rng.fork('sales-plan');
  let n = 0;
  for (const year of [2024, 2025]) {
    for (const s of st.params.scenario.sales[String(year)] ?? []) {
      const prog = st.progParams.get(s.programme)!;
      const already = new Set(st.sales.flatMap((x) => x.dwellingIds));
      let candidates: Dwelling[];
      if (prog.pavilions) {
        const forbidden = new Set(s.programme === 'CLF' ? closFleuri2026Buildings(st) : []);
        candidates = st.dwellings.filter((d) => d.programmeId === s.programme && !already.has(d.id) && !forbidden.has(d.buildingId));
      } else {
        // apartments of the first building only (sale plan approved by the board)
        const b = st.buildings.find((x) => x.programmeId === s.programme)!;
        candidates = st.dwellings.filter((d) => d.buildingId === b.id && !already.has(d.id));
      }
      for (let i = 0; i < s.units; i++) {
        const d = candidates[i]!;
        n++;
        const month = rng.int(2, 11);
        const deedDate = isoDate(year, month, rng.int(3, 26));
        const promiseDate = addDays(deedDate, -rng.int(70, 110));
        st.sales.push({
          id: `V${year}-${String(n).padStart(3, '0')}`,
          programmeId: s.programme,
          dwellingIds: [d.id],
          componentIds: [],
          buyer: '',
          promiseDate,
          deedDate,
          paymentDate: addDays(deedDate, rng.int(4, 9)),
          notaryId: rng.pick(['NOTAIRE_GIRARD', 'NOTAIRE_LECLERC']),
          price: 0,
        });
      }
    }
  }
  // Clos Fleuri: promises of 12/12/2025, deeds of 14/01/2026 (A03)
  const cf = st.params.scenario.specific.closFleuri2026;
  const buildings = closFleuri2026Buildings(st);
  const prices = allocate(eur(cf.priceEuros), buildings.map((_, i) => 1 + (i % 3) * 0.04));
  buildings.forEach((b, i) => {
    const d = st.dwellings.find((x) => x.buildingId === b)!;
    st.sales.push({
      id: `V2026-${String(i + 1).padStart(3, '0')}`,
      programmeId: 'CLF',
      dwellingIds: [d.id],
      componentIds: [],
      buyer: '',
      promiseDate: cf.promiseDate,
      deedDate: cf.deedDate,
      paymentDate: cf.notaryPaymentDate,
      notaryId: 'NOTAIRE_GIRARD',
      price: prices[i]!,
    });
  });
}

// ---------------------------------------------------------------------------
// Leases
// ---------------------------------------------------------------------------

function name(rng: Rng): string {
  return `${rng.pick(LAST).toUpperCase()} ${rng.pick(FIRST)}`;
}

export function buildLeases(st: GenState): void {
  const rng = st.rng.fork('leases');
  const r = st.params.scenario.rents;
  const g = st.params.scenario.specific.glycinesB;
  const rev2025 = st.params.regulatory.rentRevision.byYear['2025']!.appliedPct / 100;
  const saleOf = new Map<string, Sale>();
  for (const s of st.sales) for (const d of s.dwellingIds) saleOf.set(d, s);
  let leaseN = 0;
  let tenantN = 0;
  const monthlyHazard = r.turnoverPerYear / 12;

  const newLease = (d: Dwelling, start: string, inPlaceAt2024: boolean): Lease => {
    leaseN++;
    tenantN++;
    const typoIndex = ['T1', 'T2', 'T3', 'T4', 'T5'].indexOf(d.typology);
    const rlsEligible = rng.chance(r.rlsShare);
    const rls2024 = rlsEligible ? Math.round(r.rlsMonthlyEuros[typoIndex]! * rng.uniform(0.85, 1.15) * 100) : 0;
    const apl = rlsEligible || rng.chance(0.08) ? Math.round(Math.max(40, rng.normal(r.aplMonthlyMeanEuros, 70)) * 100) : 0;
    const rent2024 = d.rent2024;
    const rent2025 = inPlaceAt2024 || start < '2025-01-01' ? Math.round(rent2024 * (1 + rev2025)) : Math.round(rent2024 * (1 + rev2025));
    const lease: Lease = {
      id: `B${String(leaseN).padStart(5, '0')}`,
      dwellingId: d.id,
      programmeId: d.programmeId,
      tenantId: `T${String(tenantN).padStart(5, '0')}`,
      tenantName: name(rng),
      start,
      rent: { y2024: rent2024, y2025: rent2025 },
      chargeProvision: { y2024: d.chargeProvision, y2025: Math.round(d.chargeProvision * 1.04) },
      rls: { y2024: rls2024, y2025: Math.round(rls2024 * (1 + rev2025)) },
      apl: { y2024: Math.min(apl, rent2024), y2025: Math.min(Math.round(apl * 0.99), rent2025) },
      deposit: Math.round((inPlaceAt2024 ? rent2024 * rng.uniform(0.82, 0.97) : rent2024)),
      regulated: d.regulated,
    };
    st.leases.push(lease);
    return lease;
  };

  const MONTHS: [number, number][] = [];
  for (const y of [2024, 2025]) for (let m = 1; m <= 12; m++) MONTHS.push([y, m]);

  for (const d of st.dwellings) {
    const sale = saleOf.get(d.id);
    if (d.programmeId === 'TIL') {
      const start = rng.chance(0.77) ? '2025-07-01' : '2025-08-01';
      newLease(d, start, false);
      continue;
    }
    // last month the dwelling can be let (sales: until the month before the deed)
    const saleLimit = sale && sale.deedDate < '2026-01-01' ? endOfMonth(Number(sale.deedDate.slice(0, 4)), Number(sale.deedDate.slice(5, 7))) : null;
    let current: Lease | null = null;
    let vacantUntil = -1;
    if (rng.chance(0.972)) {
      const startYear = rng.int(1994, 2023);
      current = newLease(d, isoDate(startYear, rng.int(1, 12), 1), true);
    } else vacantUntil = rng.int(0, 3);
    for (let i = 0; i < MONTHS.length; i++) {
      const [y, m] = MONTHS[i]!;
      const monthEnd = endOfMonth(y, m);
      if (saleLimit && monthEnd >= saleLimit) {
        if (current) {
          const prevEnd = addDays(monthStart(y, m), -1);
          current.end = prevEnd < current.start ? current.start : prevEnd;
          current.endReason = 'sale';
          current = null;
        }
        break;
      }
      if (current) {
        const glbRelocation = d.programmeId === 'GLB' && y === 2025 && m >= 9;
        if (!glbRelocation && rng.chance(monthlyHazard)) {
          current.end = monthEnd;
          current.endReason = 'departure';
          current = null;
          vacantUntil = i + Math.max(1, Math.round(rng.uniform(0.5, r.vacancyMonthsMean * 1.6)));
        }
      } else if (i > vacantUntil) {
        const frozen = d.programmeId === 'GLB' && (y > 2024 || m >= 7);
        if (!frozen) current = newLease(d, monthStart(y, m), false);
      }
    }
  }
  // Glycines B relocations (September–December 2025)
  const glb = st.leases.filter((l) => l.programmeId === 'GLB' && !l.end);
  const relocated = glb.slice(0, Math.min(g.relocatedBy2025End, glb.length));
  relocated.forEach((l, i) => {
    l.end = endOfMonth(2025, 9 + (i % 4));
    l.endReason = 'relocation';
  });
}

// ---------------------------------------------------------------------------
// Rent roll
// ---------------------------------------------------------------------------

export function buildRentRoll(st: GenState): RentRoll {
  const roll: RentRoll = new Map();
  const r = st.params.scenario.rents;
  const byProg = new Map<string, Lease[]>();
  for (const l of st.leases) byProg.set(l.programmeId, [...(byProg.get(l.programmeId) ?? []), l]);
  const dwellingsByProg = new Map<string, number>();
  for (const d of st.dwellings) dwellingsByProg.set(d.programmeId, (dwellingsByProg.get(d.programmeId) ?? 0) + 1);
  const soldBy = (year: number, month: number) => new Set(st.sales.filter((s) => s.deedDate <= endOfMonth(year, month)).flatMap((s) => s.dwellingIds));
  for (const p of st.programmes) {
    const pp = st.progParams.get(p.id)!;
    const perYear = new Map<number, RentRollMonth[]>();
    for (const year of [2024, 2025]) {
      const months: RentRollMonth[] = [];
      for (let m = 1; m <= 12; m++) {
        const key = year === 2024 ? 'y2024' : 'y2025';
        const mm: RentRollMonth = { rentsRegulated: 0, rentsOther: 0, commercial: 0, parking: 0, rls: 0, chargeProvisions: 0, apl: 0, newDeposits: 0, occupiedUnits: 0, units: 0 };
        if (p.kind === 'family') {
          const sold = soldBy(year, m);
          mm.units = (dwellingsByProg.get(p.id) ?? 0) - st.dwellings.filter((d) => d.programmeId === p.id && sold.has(d.id)).length;
          if (p.id === 'TIL' && (year === 2024 || m < 7)) mm.units = 0;
          for (const l of byProg.get(p.id) ?? []) {
            if (!activeIn(l, year, m)) continue;
            mm.occupiedUnits++;
            if (l.regulated) mm.rentsRegulated += l.rent[key];
            else mm.rentsOther += l.rent[key];
            mm.rls += l.rls[key];
            mm.chargeProvisions += l.chargeProvision[key];
            mm.apl += l.apl[key];
            if (l.start === monthStart(year, m)) mm.newDeposits += l.deposit;
          }
          const index = year === 2025 ? 1.032 : 1;
          mm.commercial = Math.round(pp.commercialUnits * r.commercialMonthlyEuros * index * 100);
          mm.parking = Math.round(pp.parkingSpaces * r.parkingOccupancy * r.parkingMonthlyEuros * index * 100);
        }
        months.push(mm);
      }
      perYear.set(year, months);
    }
    roll.set(p.id, perYear);
  }
  return roll;
}

export function rollTotals(roll: RentRoll, year: number): RentRollMonth {
  const t: RentRollMonth = { rentsRegulated: 0, rentsOther: 0, commercial: 0, parking: 0, rls: 0, chargeProvisions: 0, apl: 0, newDeposits: 0, occupiedUnits: 0, units: 0 };
  for (const perYear of roll.values()) {
    for (const mm of perYear.get(year) ?? []) {
      t.rentsRegulated += mm.rentsRegulated;
      t.rentsOther += mm.rentsOther;
      t.commercial += mm.commercial;
      t.parking += mm.parking;
      t.rls += mm.rls;
      t.chargeProvisions += mm.chargeProvisions;
      t.apl += mm.apl;
      t.newDeposits += mm.newDeposits;
      t.occupiedUnits += mm.occupiedUnits;
      t.units += mm.units;
    }
  }
  return t;
}

/** Scales rents, RLS and deposits so that 2024 net rents, 2024 RLS and deposits hit their targets. */
export function calibrateRents(st: GenState, residenceFees2024: Cents): void {
  const cal = st.params.calibration.clean;
  const rlsTarget = eur(cal['2024']!['rls']!.value!);
  const rentsNetTarget = eur(cal['2024']!['rentsNet']!.value!);
  let roll = buildRentRoll(st);
  const t = rollTotals(roll, 2024);
  const rlsScale = rlsTarget / t.rls;
  for (const l of st.leases) {
    l.rls.y2024 = Math.round(l.rls.y2024 * rlsScale);
    l.rls.y2025 = Math.round(l.rls.y2025 * rlsScale);
  }
  const grossTarget = rentsNetTarget + rlsTarget - residenceFees2024 - t.commercial - t.parking;
  const rentScale = grossTarget / (t.rentsRegulated + t.rentsOther);
  for (const d of st.dwellings) d.rent2024 = Math.round(d.rent2024 * rentScale);
  for (const l of st.leases) {
    l.rent.y2024 = Math.round(l.rent.y2024 * rentScale);
    l.rent.y2025 = Math.round(l.rent.y2025 * rentScale);
    l.deposit = Math.round(l.deposit * rentScale);
    l.apl.y2024 = Math.min(l.apl.y2024, l.rent.y2024);
    l.apl.y2025 = Math.min(l.apl.y2025, l.rent.y2025);
  }
  st.metrics['rentScale'] = rentScale;
  st.metrics['rlsScale'] = rlsScale;
  // deposits: leases running at 31/12/2024 are scaled on the 2024 target, leases starting in 2025 on the 2025 one
  const tt = st.params.scenario.tenants;
  const runningAt = (date: string) => st.leases.filter((l) => l.start <= date && (!l.end || l.end > date));
  const target2024 = eur(cal['2024']!['deposits']!.value!) - eur(tt.y2024.formerDepositsEuros);
  const old24 = runningAt('2024-12-31');
  const scaleOld = target2024 / old24.reduce((s, l) => s + l.deposit, 0);
  for (const l of st.leases) if (l.start <= '2024-12-31') l.deposit = Math.round(l.deposit * scaleOld);
  const target2025 = eur(cal['2025']!['deposits']!.value!) - eur(tt.y2025.formerDepositsEuros);
  const run25 = runningAt('2025-12-31');
  const fromOld = run25.filter((l) => l.start <= '2024-12-31').reduce((s, l) => s + l.deposit, 0);
  const new25 = run25.filter((l) => l.start > '2024-12-31');
  const scaleNew = (target2025 - fromOld) / new25.reduce((s, l) => s + l.deposit, 0);
  for (const l of st.leases) if (l.start > '2024-12-31') l.deposit = Math.round(l.deposit * scaleNew);
  st.metrics['depositScale'] = scaleOld;
  st.metrics['depositScaleNew'] = scaleNew;
  roll = buildRentRoll(st);
  void roll;
}

// ---------------------------------------------------------------------------
// Tenant accounts (LOGIGES)
// ---------------------------------------------------------------------------

type YearKey = 'y2023' | 'y2024' | 'y2025';

function presentAt(st: GenState, date: string): Lease[] {
  return st.leases.filter((l) => l.start <= date && (!l.end || l.end > date));
}

export interface TenantFlows {
  /** Departures with debt by programme and month: transferred balance and deposit imputed. */
  departures: Map<string, { year: number; month: number; transferred: Cents; depositImputed: Cents; depositHeld: Cents; refund: Cents }[]>;
}

export function buildTenants(st: GenState): void {
  const rng = st.rng.fork('tenants');
  const tp = st.params.scenario.tenants;
  const accounts = new Map<string, TenantAccount>();
  const accountOf = (l: Lease): TenantAccount => {
    let a = accounts.get(l.tenantId);
    if (!a) {
      a = { id: l.tenantId, name: l.tenantName, leaseId: l.id, programmeId: l.programmeId, byYear: { y2023: null, y2024: null, y2025: null } };
      accounts.set(l.tenantId, a);
    }
    return a;
  };
  const monthlyShare = (l: Lease, key: 'y2024' | 'y2025') => Math.max(5000, l.rent[key] + l.chargeProvision[key] - l.rls[key] - l.apl[key]);

  // --- present tenants at each year end ---
  let previousCategory = new Map<string, TenantCategory>();
  const discharged = new Set<string>();
  for (const [yk, date] of [['y2023', '2023-12-31'], ['y2024', '2024-12-31'], ['y2025', '2025-12-31']] as [YearKey, string][]) {
    const present = presentAt(st, date).filter((l) => !discharged.has(l.tenantId));
    const target = tp[yk];
    const pool = new Set(rng.shuffle(present).map((l) => l.id));
    const byId = new Map(present.map((l) => [l.id, l]));
    /** Draws `count` tenants, preferring those who were in `prefer` last year (persistence ≈ 75 %). */
    const take = (count: number, prefer: TenantCategory | null) => {
      const out: Lease[] = [];
      if (prefer) {
        const keep = Math.round(count * 0.75);
        for (const id of pool) {
          if (out.length >= keep) break;
          const l = byId.get(id)!;
          if (previousCategory.get(l.tenantId) === prefer) {
            out.push(l);
            pool.delete(id);
          }
        }
      }
      for (const id of pool) {
        if (out.length >= count) break;
        const l = byId.get(id)!;
        if (prefer && previousCategory.has(l.tenantId) && previousCategory.get(l.tenantId) !== prefer && previousCategory.get(l.tenantId) !== 'present') continue;
        out.push(l);
        pool.delete(id);
      }
      return out;
    };
    const assign = (leases: Lease[], total: Cents, category: TenantCategory, months: [number, number]) => {
      const key = yk === 'y2023' ? 'y2024' : yk;
      const weights = leases.map((l) => monthlyShare(l, key) * rng.uniform(months[0], months[1]));
      const parts = allocate(total, weights);
      leases.forEach((l, i) => {
        const a = accountOf(l);
        const balance = parts[i]!;
        a.byYear[yk] = { balance, category, ageMonths: Math.max(1, Math.round(balance / monthlyShare(l, key))), depositHeld: 0 };
      });
    };
    const n = present.length;
    const debtDischarge = yk === 'y2024' ? take(Math.round(238000 / 5300), 'presentOver6m') : [];
    if (yk === 'y2024') {
      assign(debtDischarge, eur(tp.y2024.debtDischargeEuros), 'debtDischarge', [7, 14]);
      for (const l of debtDischarge) discharged.add(l.tenantId);
    }
    assign(take(Math.round(n * 0.035), 'presentOver6m'), eur(target.over6mEuros), 'presentOver6m', [6.5, 13]);
    assign(take(Math.round(n * 0.017), 'procedure'), eur(target.procedureEuros), 'procedure', [8, 18]);
    assign(take(Math.round(n * 0.12), 'present'), eur(target.presentEuros), 'present', [1, 5]);
    const creditLeases = take(Math.round(n * 0.22), null);
    const credits = allocate(-eur(target.creditEuros), creditLeases.map(() => rng.lognormal(1, 0.8)));
    creditLeases.forEach((l, i) => {
      accountOf(l).byYear[yk] = { balance: credits[i]!, category: 'present', ageMonths: 0, depositHeld: 0 };
    });
    previousCategory = new Map([...accounts.values()].filter((a) => (a.byYear[yk]?.balance ?? 0) > 0).map((a) => [a.id, a.byYear[yk]!.category] as [string, TenantCategory]));
    // debt discharge (rétablissement personnel) decided in 2025: written off in the clean world
    if (yk === 'y2025') {
      for (const a of accounts.values()) {
        if (a.byYear.y2024?.category === 'debtDischarge') {
          const lease = st.leases.find((l) => l.id === a.leaseId)!;
          const stillPresent = !lease.end || lease.end > '2025-12-31';
          a.writeOff = { date: tp.debtDischargeWriteOffDate, amount: a.byYear.y2024.balance, reason: 'debtDischarge' };
          if (stillPresent) a.byYear.y2025 = { balance: 0, category: 'present', ageMonths: 0, depositHeld: 0 };
        }
      }
    }
  }
  // tenants present at a year end without a recorded balance have a zero balance
  for (const [yk, date] of [['y2023', '2023-12-31'], ['y2024', '2024-12-31'], ['y2025', '2025-12-31']] as [YearKey, string][]) {
    for (const l of presentAt(st, date)) {
      const a = accounts.get(l.tenantId);
      if (a && !a.byYear[yk]) a.byYear[yk] = { balance: 0, category: 'present', ageMonths: 0, depositHeld: 0 };
    }
  }

  // --- former tenants -----------------------------------------------------
  const formers: TenantAccount[] = [];
  // stock at 31/12/2023
  const stockCount = 1060;
  const stockNet = allocate(eur(tp.y2023.formerNetEuros), Array.from({ length: stockCount }, () => rng.lognormal(1, 0.9)));
  const stockHeld = allocate(eur(tp.y2023.formerDepositsEuros), Array.from({ length: 380 }, () => rng.uniform(0.7, 1.3)));
  for (let i = 0; i < stockCount; i++) {
    const held = i < stockHeld.length ? stockHeld[i]! : 0;
    const departure = isoDate(rng.int(2015, 2023), rng.int(1, 12), 28);
    formers.push({
      id: `X${String(i + 1).padStart(5, '0')}`,
      name: name(rng),
      programmeId: rng.pick(st.programmes.filter((p) => p.kind === 'family' && p.id !== 'TIL')).id,
      byYear: { y2023: { balance: stockNet[i]! + held, category: 'former', ageMonths: 0, depositHeld: held }, y2024: null, y2025: null },
      departure: { date: departure, balance: stockNet[i]! + held, depositHeld: held },
    });
  }
  // yearly flows
  for (const [year, prevKey, key] of [[2024, 'y2023', 'y2024'], [2025, 'y2024', 'y2025']] as [number, YearKey, YearKey][]) {
    const targetNet = eur(tp[key].formerNetEuros);
    const targetHeld = eur(tp[key].formerDepositsEuros);
    const writeOffTarget = eur(tp.writeOffsEuros[String(year)]!);
    const alive = formers.filter((f) => (f.byYear[prevKey]?.balance ?? 0) > 0);
    const openingNet = alive.reduce((s, f) => s + f.byYear[prevKey]!.balance - f.byYear[prevKey]!.depositHeld, 0);
    // write-offs: oldest accounts first
    const byAge = [...alive].sort((a, b) => (a.departure!.date < b.departure!.date ? -1 : 1));
    let written = 0;
    const writtenIds = new Set<string>();
    for (const f of byAge) {
      if (written >= writeOffTarget) break;
      const prev = f.byYear[prevKey]!;
      const net = prev.balance - prev.depositHeld;
      if (written + net > writeOffTarget * 1.02 && written > 0) continue;
      written += net;
      writtenIds.add(f.id);
      f.writeOff = { date: isoDate(year, [3, 6, 9, 12][rng.int(0, 3)]!, 28), amount: net, reason: 'irrecoverable' };
    }
    // recoveries (≈ 4 % of the opening base)
    const recoveryTarget = Math.round(openingNet * tp.recoveryRate);
    const payers = alive.filter((f) => !writtenIds.has(f.id));
    const recParts = allocate(recoveryTarget, payers.map((f) => (rng.chance(0.25) ? f.byYear[prevKey]!.balance : 0)));
    const recovered = new Map<string, Cents>();
    payers.forEach((f, i) => {
      const amount = Math.min(recParts[i]!, f.byYear[prevKey]!.balance - f.byYear[prevKey]!.depositHeld);
      if (amount > 0) recovered.set(f.id, amount);
    });
    const totalRecovered = [...recovered.values()].reduce((a, b) => a + b, 0);
    // carry over
    for (const f of alive) {
      const prev = f.byYear[prevKey]!;
      if (writtenIds.has(f.id)) {
        f.byYear[key] = null;
        continue;
      }
      const rec = recovered.get(f.id) ?? 0;
      if (rec > 0) f.recoveries = [...(f.recoveries ?? []), { year, amount: rec }];
      f.byYear[key] = { balance: prev.balance - rec, category: 'former', ageMonths: 0, depositHeld: prev.depositHeld };
    }
    // new former tenants: departures of the year with debt
    const carriedNet = openingNet - written - totalRecovered;
    const newNet = Math.max(0, targetNet - carriedNet);
    const departures = st.leases.filter((l) => l.endReason === 'departure' && l.end && l.end.startsWith(`${year}-`));
    const debtors = departures.filter(() => rng.chance(st.params.scenario.rents.departuresWithDebtShare));
    const nets = allocate(newNet, debtors.map(() => rng.lognormal(1, 0.75)));
    const carriedHeld = formers.reduce((s, f) => s + (f.byYear[key]?.depositHeld ?? 0), 0);
    let heldLeft = Math.max(0, targetHeld - carriedHeld);
    debtors.forEach((l, i) => {
      const net = nets[i]!;
      const hold = heldLeft > 0 && rng.chance(0.4) ? Math.min(l.deposit, heldLeft) : 0;
      heldLeft -= hold;
      const acc = accountOf(l);
      acc.departure = { date: l.end!, balance: net + hold, depositHeld: hold };
      acc.byYear[key] = { balance: net + hold, category: 'former', ageMonths: 0, depositHeld: hold };
      formers.push(acc);
    });
    // remaining held deposits: spread over new accounts, within their own deposit
    for (const l of debtors) {
      if (heldLeft <= 0) break;
      const acc = accountOf(l);
      const extra = Math.min(heldLeft, l.deposit - acc.departure!.depositHeld);
      if (extra <= 0) continue;
      acc.departure!.depositHeld += extra;
      acc.departure!.balance += extra;
      acc.byYear[key]!.depositHeld += extra;
      acc.byYear[key]!.balance += extra;
      heldLeft -= extra;
    }
    st.metrics[`formerHeldGap${year}`] = heldLeft;
  }
  // ageing of former tenants
  for (const f of formers) {
    for (const [yk, date] of [['y2024', '2024-12-31'], ['y2025', '2025-12-31']] as [YearKey, string][]) {
      const y = f.byYear[yk];
      if (y && f.departure) y.ageMonths = Math.max(1, Math.round((Date.parse(date) - Date.parse(f.departure.date)) / (30.44 * 86400000)));
    }
  }
  const all = new Map<string, TenantAccount>();
  for (const a of accounts.values()) all.set(a.id, a);
  for (const f of formers) all.set(f.id, f);
  st.tenants = [...all.values()].filter((a) => Object.values(a.byYear).some((y) => y && y.balance !== 0) || a.departure || a.writeOff);
}

/** Receivables impairment charge of 2025 under the presented method (A07: 85 % on former tenants; A15: none). */
export function presentedImpairmentCharge(st: GenState): Cents {
  const m = st.params.scenario.tenants.presentedMethod;
  const rate = (t: TenantAccount, key: YearKey, presented: boolean): { account: string; amount: Cents } | null => {
    const y = t.byYear[key];
    if (!y || y.balance <= 0) return null;
    if (y.category === 'presentOver6m' || y.category === 'debtDischarge') return { account: '4911', amount: Math.round(y.balance * 0.5) };
    if (y.category === 'procedure') return { account: '4916', amount: y.balance };
    if (y.category === 'former') return { account: '4915', amount: Math.round(Math.max(0, y.balance - y.depositHeld) * (presented ? m.formerRate : 1)) };
    return null;
  };
  let charge = 0;
  for (const t of st.tenants) {
    if (t.writeOff?.reason === 'debtDischarge') continue; // unchanged in the presented accounts
    const byAccount = new Map<string, Cents>();
    const prev = rate(t, 'y2024', false);
    const cur = rate(t, 'y2025', true);
    if (prev) byAccount.set(prev.account, -prev.amount);
    if (cur) byAccount.set(cur.account, (byAccount.get(cur.account) ?? 0) + cur.amount);
    for (const d of byAccount.values()) if (d > 0) charge += d;
  }
  return charge;
}

/**
 * Moves an amount between a carried-over and a new former-tenant account (same
 * totals) so that the presented 2025 impairment charge equals its target.
 */
export function calibratePresentedImpairment(st: GenState): void {
  const target = eur((st.params.calibration.anomalyMetrics['presentedImpairmentChargeA21'] as { value: number }).value);
  const rate = st.params.scenario.tenants.presentedMethod.formerRate;
  const current = presentedImpairmentCharge(st);
  const x = Math.round((target - current) / rate);
  if (x === 0) return;
  const newOnes = st.tenants.filter((t) => t.departure?.date.startsWith('2025-') && t.byYear.y2025?.category === 'former' && !t.writeOff);
  const carried = st.tenants.filter((t) => t.byYear.y2024?.category === 'former' && t.byYear.y2025?.category === 'former' && !t.writeOff);
  const n = newOnes.sort((a, b) => b.byYear.y2025!.balance - a.byYear.y2025!.balance)[0]!;
  const c = carried.sort((a, b) => b.byYear.y2025!.balance - a.byYear.y2025!.balance)[0]!;
  n.byYear.y2025!.balance += x;
  n.departure!.balance += x;
  c.byYear.y2025!.balance -= x;
  c.recoveries = [...(c.recoveries ?? []).filter((r) => r.year !== 2025), { year: 2025, amount: (c.recoveries?.find((r) => r.year === 2025)?.amount ?? 0) + x }];
  st.metrics['presentedImpairmentCharge'] = presentedImpairmentCharge(st);
}
