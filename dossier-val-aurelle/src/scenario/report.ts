/**
 * Figures of the management report (rapport de gestion) derived from the
 * world: supplier payment terms, vacancy, net self-financing. A14 replaces
 * some of them by the values the client wrote (presentation facts).
 */
import type { KeyFigures } from '../engine/analysis';
import type { Cents } from '../engine/money';
import type { World } from '../engine/types';
import type { PresentationFacts } from './anomalies/draft';
import type { Invoice, ScenarioDatasets } from './datasets';

export interface VacancyFigures {
  date: string;
  /** Family dwellings in the stock at the date, vacant, and technically vacant (demolition, works, heavy repairs). */
  stock: number;
  vacant: number;
  technical: number;
  vacantTechnical: number;
  /** Definition of the previous year: every vacant dwelling. */
  totalRate: number;
  /** Commercial vacancy only (technical vacancy excluded from numerator and denominator). */
  excludingTechnicalRate: number;
}

/** Vacancy of the family dwellings at the year end (taux de vacance au 31/12). */
export function vacancy(ds: ScenarioDatasets, year: number): VacancyFigures {
  const date = `${year}-12-31`;
  const family = new Set(ds.programmes.filter((p) => p.kind === 'family').map((p) => p.id));
  const inService = new Map(ds.programmes.map((p) => [p.id, p.inServiceDate]));
  const soldOn = new Map<string, string>();
  for (const s of ds.sales) for (const d of s.dwellingIds) soldOn.set(d, s.deedDate);
  const occupied = new Set(ds.leases.filter((l) => l.start <= date && (!l.end || l.end >= date)).map((l) => l.dwellingId));
  let stock = 0;
  let vacant = 0;
  let technical = 0;
  let vacantTechnical = 0;
  for (const d of ds.dwellings) {
    if (!family.has(d.programmeId) || (inService.get(d.programmeId) ?? '') > date) continue;
    const sold = soldOn.get(d.id);
    if (sold && sold <= date) continue;
    stock++;
    const tech = !!d.technicalVacancy && d.technicalVacancy.from <= date;
    if (tech) technical++;
    if (!occupied.has(d.id)) {
      vacant++;
      if (tech) vacantTechnical++;
    }
  }
  return {
    date,
    stock,
    vacant,
    technical,
    vacantTechnical,
    totalRate: stock === 0 ? 0 : vacant / stock,
    excludingTechnicalRate: stock - technical === 0 ? 0 : (vacant - vacantTechnical) / (stock - technical),
  };
}

export interface PaymentTermsFigures {
  count: number;
  amount: Cents;
  /** Overdue invoices by days past due at the year end. */
  buckets: { id: string; label: string; count: number; amount: Cents }[];
}

export function supplierPaymentTerms(invoices: readonly Invoice[], year: number): PaymentTermsFigures {
  const end = `${year}-12-31`;
  const overdue = invoices.filter((i) => i.receivedDate <= end && i.dueDate < end && (!i.paidDate || i.paidDate > end));
  const days = (i: Invoice) => Math.round((Date.parse(end) - Date.parse(i.dueDate)) / 86_400_000);
  const defs: [string, string, number, number][] = [
    ['1-30', '1 à 30 jours', 1, 30],
    ['31-60', '31 à 60 jours', 31, 60],
    ['61-90', '61 à 90 jours', 61, 90],
    ['91+', '91 jours et plus', 91, Infinity],
  ];
  return {
    count: overdue.length,
    amount: overdue.reduce((s, i) => s + i.total, 0),
    buckets: defs.map(([id, label, lo, hi]) => {
      const sel = overdue.filter((i) => days(i) >= lo && days(i) <= hi);
      return { id, label, count: sel.length, amount: sel.reduce((s, i) => s + i.total, 0) };
    }),
  };
}

export interface ManagementReport {
  year: number;
  netResult: Cents;
  rents: Cents;
  paymentTerms: { computed: PaymentTermsFigures; shown: { count: number; amount: Cents } };
  vacancy: { computed: VacancyFigures; shownRate: number; definition: 'total' | 'excludingTechnical' };
  netSelfFinancing: { computedRatio: number; shownRatio: number };
}

/**
 * Management report of a world state. `presentedRatio` is the net
 * self-financing ratio of the presented accounts, shown as long as A14-iii is
 * not corrected.
 */
export function managementReport(world: World, figures: KeyFigures, facts: PresentationFacts, presentedRatio: number = figures.netSelfFinancingRatio): ManagementReport {
  const ds = world.datasets as unknown as ScenarioDatasets;
  const year = world.meta.currentYear;
  const terms = supplierPaymentTerms(ds.invoices, year);
  const vac = vacancy(ds, year);
  const definition = facts.report['vacancy.definition'] === 'excludingTechnical' ? 'excludingTechnical' : 'total';
  return {
    year,
    netResult: figures.netResult,
    rents: figures.rents,
    paymentTerms: { computed: terms, shown: facts.report['paymentTerms.overdue'] === 'none' ? { count: 0, amount: 0 } : { count: terms.count, amount: terms.amount } },
    vacancy: { computed: vac, shownRate: definition === 'total' ? vac.totalRate : vac.excludingTechnicalRate, definition },
    netSelfFinancing: { computedRatio: figures.netSelfFinancingRatio, shownRatio: facts.report['netSelfFinancing.basis'] === 'presented' ? presentedRatio : figures.netSelfFinancingRatio },
  };
}
