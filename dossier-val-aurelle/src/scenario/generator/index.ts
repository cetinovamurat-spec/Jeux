/** Clean-world generator: params + levers → World (2024 certified, 2025 clean). */
import { closingBalances } from '../../engine/balance';
import { keyFigures, type KeyFigures } from '../../engine/analysis';
import { endOfMonth } from '../../engine/dates';
import { allocate, type Cents } from '../../engine/money';
import { createRng } from '../../engine/rng';
import type { World } from '../../engine/types';
import type { ScenarioDatasets } from '../datasets';
import { loadParams, type Params } from '../params';
import leversJson from '../params/levers.json';
import { DEFAULT_LEVERS, eur, type GenState, type Levers } from './core';
import { buildLoans, flatRateIcneError } from './loans';
import { buildAssets, buildProgrammes, buildThirdParties, finaliseSubsidies } from './portfolio';
import { postLedgers, rentExcessByProgramme } from './posting';
import {
  buildMaintenancePlan,
  buildOperatingInvoices,
  buildPayroll,
  buildRegularisations,
  buildTaxes,
  investmentInvoices,
  markOverdueInvoices,
  openingSupplierInvoices,
  resetInvoiceCounter,
} from './purchases';
import { buildSales, closFleuriBookValue } from './sales';
import { buildLeases, buildRentRoll, buildTenants, calibratePresentedImpairment, calibrateRents, planSales } from './tenancy';

export const GENERATOR_VERSION = '1.0.0';

export function storedLevers(): Levers {
  return { ...DEFAULT_LEVERS, ...(leversJson as Partial<Levers>) };
}

export interface GenerationResult {
  world: World;
  state: GenState;
  figures: { y2024: KeyFigures; y2025: KeyFigures };
}

function loanRepayments(st: GenState, year: number): Cents {
  let s = 0;
  for (const loan of st.loans) {
    if (loan.activity !== 'rental') continue;
    for (const l of st.schedules.get(loan.id)!) if (l.dueDate.startsWith(`${year}-`) && !l.early) s += l.principal;
  }
  return s;
}

export function generateWorld(params: Params = loadParams(), levers: Levers = storedLevers()): GenerationResult {
  const st: GenState = {
    params,
    levers,
    rng: createRng(params.scenario.seed),
    progParams: new Map(),
    programmes: [],
    buildings: [],
    dwellings: [],
    operations: [],
    components: [],
    subsidies: [],
    thirdParties: [],
    loans: [],
    schedules: new Map(),
    leases: [],
    tenants: [],
    invoices: [],
    sales: [],
    taxNotices: [],
    regularisations: [],
    caretakers: [],
    payroll: [],
    maintenancePlan: [],
    pge: [],
    wip: [],
    metrics: {},
  };
  resetInvoiceCounter();
  buildThirdParties(st);
  buildProgrammes(st);
  buildAssets(st);
  planSales(st);
  buildLeases(st);
  const residenceFees2024 = params.programmes.filter((p) => p.kind === 'collective').reduce((s, p) => s + eur((p.monthlyFeeEuros ?? 0) * 12), 0);
  calibrateRents(st, residenceFees2024);
  buildTenants(st);
  calibratePresentedImpairment(st);
  buildLoans(st);
  investmentInvoices(st);
  buildSales(st);
  buildPayroll(st);
  buildTaxes(st);
  buildMaintenancePlan(st);
  openingSupplierInvoices(st);
  const prepaidInsurance = buildOperatingInvoices(st, 1);
  const roll = buildRentRoll(st);
  // recoverable charges: scale the recoverable natures so that 2025 recoveries hit their target
  buildRegularisations(st, roll);
  const natures = new Set(Object.keys(params.scenario.charges.recoverable));
  const target = eur(params.calibration.clean['2025']!['chargeRecoveries']!.value!);
  let scaled = 0;
  let fixed = 0;
  for (const r of st.regularisations.filter((x) => x.year === 2025)) {
    const occ = r.recoverable / Math.max(1, Object.values(r.expenses).reduce((a, b) => a + b, 0));
    for (const [k, x] of Object.entries(r.expenses)) (natures.has(k) ? (scaled += x * occ) : (fixed += x * occ));
  }
  const recoverableScale = (target - fixed) / scaled;
  st.metrics['recoverableScale'] = recoverableScale;
  for (const inv of st.invoices) {
    if (!inv.lines.some((l) => l.nature && natures.has(l.nature))) continue;
    const newTotal = Math.round(inv.total * recoverableScale);
    const parts = allocate(newTotal, inv.lines.map((l) => l.amount));
    (inv as { lines: typeof inv.lines }).lines = inv.lines.map((l, i) => ({ ...l, amount: parts[i]! }));
    inv.total = newTotal;
  }
  markOverdueInvoices(st);
  buildRegularisations(st, roll);
  finaliseSubsidies(st);

  const { prior, current } = postLedgers(st, { roll, prepaidInsurance });

  // anomaly calibration metrics (J2)
  st.metrics['icneFlatRateErrorA08'] = flatRateIcneError(st, '2025-12-31', 3.0);
  st.metrics['closFleuriNbvA03'] = closFleuriBookValue(st);
  let saules = 0;
  for (const l of st.leases) {
    const active = l.programmeId === 'SAU' && l.start <= '2025-10-01' && (!l.end || l.end >= endOfMonth(2025, 10));
    if (active) saules += l.rent.y2025 - l.rls.y2025;
  }
  const sauOct = roll.get('SAU')!.get(2025)![9]!;
  st.metrics['rentExcessA17'] = [...rentExcessByProgramme(st, 2025).values()].reduce((a, x) => a + x, 0);
  st.metrics['rentBatchSaulesOctoberA19'] = saules + sauOct.commercial + sauOct.parking;

  const datasets: ScenarioDatasets = {
    programmes: st.programmes,
    buildings: st.buildings,
    dwellings: st.dwellings,
    components: st.components,
    operations: st.operations,
    subsidies: st.subsidies,
    loans: st.loans,
    loanSchedules: [...st.schedules.values()].flat(),
    thirdParties: st.thirdParties,
    leases: st.leases,
    tenants: st.tenants,
    invoices: st.invoices,
    sales: st.sales,
    taxNotices: st.taxNotices,
    regularisations: st.regularisations,
    caretakers: st.caretakers,
    payroll: st.payroll,
    maintenancePlan: st.maintenancePlan,
    pge: st.pge,
    history: params.scenario.history.map((h) => ({ year: h.year, netResult: eur(h.netResultEuros), rents: eur(h.rentsEuros), netSelfFinancingRatioPct: h.netSelfFinancingRatioPct, capital: eur(params.scenario.entity.capitalEuros) })),
  };
  const auxiliaries: Record<string, string> = {};
  for (const t of st.thirdParties) if (t.aux) auxiliaries[t.aux] = t.name;
  auxiliaries['DGFIP'] = 'Direction générale des finances publiques';
  for (const p of st.programmes) {
    auxiliaries[`LOG-${p.id}`] = `LOGIGES (ancien) – ${p.name}`;
    auxiliaries[`LG2-${p.id}`] = `LOGIGES 2 – ${p.name}`;
  }
  const world: World = {
    meta: { scenarioId: 'val-aurelle-2025', seed: params.scenario.seed, generatorVersion: GENERATOR_VERSION, entityName: params.scenario.entity.name, currentYear: 2025, priorYear: 2024 },
    chart: params.chart,
    journals: [
      { code: 'AN', label: 'À-nouveaux', kind: 'opening' },
      { code: 'QT', label: 'Quittancement – interface de gestion locative', kind: 'rentInterface' },
      { code: 'AC', label: 'Achats', kind: 'purchases' },
      { code: 'BQ', label: 'Banque', kind: 'bank' },
      { code: 'PA', label: 'Paie – interface', kind: 'payroll' },
      { code: 'OD', label: 'Opérations diverses', kind: 'misc' },
    ],
    auxiliaries,
    ledgers: { prior, current },
    datasets: datasets as unknown as Record<string, unknown>,
    presentation: { reclassifications: [], annexCells: [] },
  };
  const figures = {
    y2024: keyFigures(closingBalances(prior), params.analysis, loanRepayments(st, 2024)),
    y2025: keyFigures(closingBalances(current), params.analysis, loanRepayments(st, 2025)),
  };
  return { world, state: st, figures };
}
