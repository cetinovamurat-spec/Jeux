/**
 * Debt portfolio (≈ 120 loans) calibrated so that, at 31/12/2025:
 * outstanding = 365 M€ (307,5 M€ Banque des Territoires, of which a 2,5 M€
 * zero-rate PHB), interest accruals 2024 ≈ 11,3 M€ (option 1 validated),
 * repayments ≈ 13,0 / 13,4 M€, and the flat-rate ICNE error of A08 ≈ 236 k€.
 */
import { addMonths, isoDate } from '../../engine/dates';
import type { Cents } from '../../engine/money';
import { accruedInterest, buildSchedule, outstandingAt, type RateChange } from '../../engine/subledgers/loans';
import type { Loan, LoanRate, LoanScheduleLine } from '../../engine/types';
import { eur, type GenState } from './core';

const UNIT = 100_000_000; // 1 M€ in cents
const SCHEDULE_UNTIL = '2031-12-31';

interface LoanDraft {
  loan: Loan;
  group: 'LA' | 'OTHER' | 'NEW';
  base: number;
  /** Contractual remaining periods before the 2019–2020 lengthening of the debt. */
  remaining?: number;
}

function lenderOf(product: string): string {
  return product === 'AL' ? 'AL' : product === 'BANQUE' ? 'BANK' : 'BDT';
}

function makeRate(st: GenState, product: string, fixedPct?: number, zeroUntil?: string): LoanRate {
  const p = st.params.loanProducts.products[product]!;
  if (product === 'PHB') return { kind: 'zeroThenLivretA', zeroUntil: zeroUntil!, marginPct: p.marginPct ?? 0.6 };
  if (p.lender === 'BDT') return { kind: 'livretA', marginPct: p.marginPct ?? 0, floorPct: 0 };
  return { kind: 'fixed', ratePct: fixedPct ?? 1 };
}

function interestAccrual(loan: Loan, schedule: readonly LoanScheduleLine[], year: number): number {
  let paid = 0;
  for (const l of schedule) if (l.dueDate.startsWith(`${year}-`)) paid += l.interest;
  return paid + accruedInterest(loan, schedule, `${year}-12-31`) - accruedInterest(loan, schedule, `${year - 1}-12-31`);
}

function repayments(schedule: readonly LoanScheduleLine[], year: number): number {
  let s = 0;
  for (const l of schedule) if (l.dueDate.startsWith(`${year}-`) && !l.early) s += l.principal;
  return s;
}

interface UnitMetrics {
  crd25: number;
  remb24: number;
  remb25: number;
  ff24: number;
  ff25: number;
  err: number;
}

function metrics(loan: Loan, history: readonly RateChange[], flatRate: number): UnitMetrics {
  const schedule = buildSchedule(loan, history, SCHEDULE_UNTIL);
  const indexed = loan.rate.kind === 'livretA';
  return {
    crd25: outstandingAt(loan, schedule, '2025-12-31'),
    remb24: repayments(schedule, 2024),
    remb25: repayments(schedule, 2025),
    ff24: interestAccrual(loan, schedule, 2024),
    ff25: interestAccrual(loan, schedule, 2025),
    err: indexed ? accruedInterest(loan, schedule, '2025-12-31', flatRate) - accruedInterest(loan, schedule, '2025-12-31') : 0,
  };
}

export function buildLoans(st: GenState): void {
  const rng = st.rng.fork('loans');
  const history = st.params.regulatory.livretA.history;
  const products = st.params.loanProducts.products;
  const cal = st.params.calibration;
  const drafts: LoanDraft[] = [];
  let n = 0;
  const contract = () => `${String(5000 + n * 37).padStart(6, '0')}`;

  const existing = (product: string, programmeId: string | undefined, startYear: number, base: number, fixedPct?: number, _termShift = 0): void => {
    n++;
    const p = products[product]!;
    const lender = lenderOf(product);
    const periodMonths = lender === 'BANK' ? 3 : 12;
    const month = rng.int(1, 12);
    const firstDue2023 = periodMonths === 12 ? isoDate(2023, month, 1) : isoDate(2023, ((month - 1) % 3) + 1, 1);
    const refDate = addMonths(firstDue2023, -periodMonths);
    const elapsedYears = 2023 - startYear;
    const totalPeriods = (p.years * 12) / periodMonths;
    const remaining = Math.max(2, Math.round(totalPeriods - (elapsedYears * 12) / periodMonths));
    const loan: Loan = {
      id: `L${String(n).padStart(3, '0')}`,
      lenderId: lender === 'BDT' ? 'BDT' : lender === 'AL' ? 'AL' : rng.pick(['BANK1', 'BANK2', 'BANK3']),
      product,
      activity: 'rental',
      account: p.account,
      contractNumber: contract(),
      principal: 0,
      startDate: isoDate(startYear, month, 1),
      refDate,
      refOutstanding: UNIT,
      remainingPeriods: remaining,
      periodMonths,
      nextDueDate: firstDue2023,
      rate: makeRate(st, product, fixedPct),
      amortisation: lender === 'BANK' ? 'constant' : 'annuity',
    };
    if (programmeId) loan.programmeId = programmeId;
    drafts.push({ loan, group: lender === 'BDT' ? 'LA' : 'OTHER', base, remaining });
  };

  // construction loans of programmes built since 1988, PLA "réaménagés" for older ones
  const termShiftLA = (st.metrics['loanTermShift'] = st.metrics['loanTermShift'] ?? 0);
  for (const p of st.params.programmes) {
    if (p.id === 'TIL') continue;
    const y = p.constructionYear;
    const size = p.units * (p.kind === 'collective' ? 0.6 : 1);
    if (y >= 2005) {
      existing('PLUS', p.id, y - 1, size * 0.55, undefined, termShiftLA);
      existing('PLUS_FONCIER', p.id, y - 1, size * 0.18, undefined, termShiftLA);
      if (p.financing.includes('PLAI')) existing('PLAI', p.id, y - 1, size * 0.22, undefined, termShiftLA);
      if (p.financing.includes('PLS')) existing('PLS', p.id, y - 1, size * 0.2, undefined, termShiftLA);
    } else if (y >= 1988) {
      existing(y >= 2000 ? 'PLUS' : 'PLA', p.id, y - 1, size * 0.5, undefined, termShiftLA);
      existing('PLUS_FONCIER', p.id, y - 1, size * 0.12, undefined, termShiftLA);
    } else {
      // debt of older programmes regrouped and extended by the lender (réaménagement 2015)
      existing('PLA', p.id, 2015, size * 0.22, undefined, termShiftLA);
    }
  }
  // rehabilitation loans
  for (const op of st.operations) {
    if (op.kind !== 'rehabilitation' || op.year < 2003 || op.year > 2023) continue;
    const prog = st.progParams.get(op.programmeId)!;
    existing('PAM', op.programmeId, op.year, prog.units * 0.3, undefined, termShiftLA);
    if (op.year >= 2010) existing('ECO', op.programmeId, op.year, prog.units * 0.12, undefined, termShiftLA);
  }
  // commercial banks and Action Logement
  const [bmin, bmax] = st.params.scenario.loans.bankRatePctRange;
  const [amin, amax] = st.params.scenario.loans.actionLogementRatePctRange;
  for (let i = 0; i < 5; i++) existing('BANQUE', undefined, rng.int(2012, 2021), rng.uniform(30, 60), Math.round(rng.uniform(bmin, bmax) * 100) / 100);
  for (let i = 0; i < 9; i++) existing('AL', undefined, rng.int(2010, 2022), rng.uniform(40, 80), Math.round(rng.uniform(amin, amax) * 100) / 100);

  // new loans 2024-2025 (fixed amounts)
  for (const nl of st.params.scenario.loans.new) {
    n++;
    const p = products[nl.product]!;
    const periodMonths = 12;
    const remaining = (p.years * 12) / periodMonths;
    const zeroUntil = nl.product === 'PHB' ? addMonths(nl.date, (p.zeroYears ?? 20) * 12) : undefined;
    const loan: Loan = {
      id: `L${String(n).padStart(3, '0')}`,
      lenderId: lenderOf(nl.product) === 'BDT' ? 'BDT' : 'AL',
      product: nl.product,
      activity: 'rental',
      account: p.account,
      contractNumber: contract(),
      principal: eur(nl.euros),
      startDate: nl.date,
      refDate: nl.date,
      refOutstanding: eur(nl.euros),
      remainingPeriods: remaining,
      periodMonths,
      nextDueDate: addMonths(nl.date, 12),
      rate: makeRate(st, nl.product, nl.ratePct, zeroUntil),
      amortisation: nl.product === 'PHB' ? 'deferred' : 'annuity',
    };
    if (nl.product === 'PHB') loan.deferredPeriods = p.zeroYears ?? 20;
    if (nl.programme) loan.programmeId = nl.programme;
    drafts.push({ loan, group: 'NEW', base: 0 });
  }

  // ---- calibration -------------------------------------------------------
  const target = cal.clean['2025']!;
  const debtTarget = eur(target['debt']!.value!);
  // 307,5 M€ owed to the Banque des Territoires at 31/12/2025 (confirmation of A18), of which the 2,5 M€ PHB
  const bdtTotal = eur(307_500_000);
  const errTarget = eur((cal.anomalyMetrics['icneFlatRateErrorA08'] as { value: number }).value);
  const ff24Target = eur(cal.clean['2024']!['financialCharges']!.value!) - eur(st.metrics['otherFinancialCharges2024'] ?? 0);
  const flatRate = 3.0;

  const calibrate = (extension: number): { weights: Map<number, number>; remb25: number; remb24: number } => {
    for (const d of drafts) if (d.group === 'LA' && d.remaining) d.loan.remainingPeriods = d.remaining + extension;
    let fixedScale = 1;
    let finalWeights = new Map<number, number>();
    for (let iter = 0; iter < 6; iter++) {
      for (const d of drafts) {
        if (d.group !== 'NEW') d.loan.refOutstanding = UNIT;
        if (d.group === 'OTHER' && d.loan.rate.kind === 'fixed') {
          const base = d.loan as Loan & { baseRate?: number };
          base.baseRate = base.baseRate ?? d.loan.rate.ratePct;
          d.loan.rate = { kind: 'fixed', ratePct: Math.max(0.1, Math.round(base.baseRate * fixedScale * 100) / 100) };
        }
      }
      const m = drafts.map((d) => metrics(d.loan, history, flatRate));
      const sumNew = (f: (u: UnitMetrics) => number, bdt: boolean | null) =>
        drafts.reduce((s, d, i) => (d.group === 'NEW' && (bdt === null || (d.loan.lenderId === 'BDT') === bdt) ? s + f(m[i]!) : s), 0);
      const newLA = sumNew((u) => u.crd25, true);
      const newOther = sumNew((u) => u.crd25, false);
      const newErr = sumNew((u) => u.err, null);
      const laTarget = bdtTotal - newLA;
      const otherTarget = debtTarget - bdtTotal - newOther;
      const laIdx = drafts.map((d, i) => (d.group === 'LA' ? i : -1)).filter((i) => i >= 0);
      const otherIdx = drafts.map((d, i) => (d.group === 'OTHER' ? i : -1)).filter((i) => i >= 0);
      // exponential tilt on the error per unit of outstanding capital
      const ratioTarget = (errTarget - newErr) / laTarget;
      const e = laIdx.map((i) => m[i]!.err / Math.max(1, m[i]!.crd25));
      const ratioFor = (lambda: number): number => {
        let num = 0;
        let den = 0;
        laIdx.forEach((i, k) => {
          const w = drafts[i]!.base * Math.exp(lambda * e[k]! * 100);
          num += w * m[i]!.err;
          den += w * m[i]!.crd25;
        });
        return num / den;
      };
      let lo = -50;
      let hi = 50;
      for (let k = 0; k < 80; k++) {
        const mid = (lo + hi) / 2;
        if (ratioFor(mid) < ratioTarget) lo = mid;
        else hi = mid;
      }
      const lambda = (lo + hi) / 2;
      st.metrics['loanTilt'] = lambda;
      const wLA = laIdx.map((i, k) => drafts[i]!.base * Math.exp(lambda * e[k]! * 100));
      const crdLA = laIdx.reduce((s, i, k) => s + wLA[k]! * m[i]!.crd25, 0);
      const sLA = laTarget / crdLA;
      const crdOther = otherIdx.reduce((s, i) => s + drafts[i]!.base * m[i]!.crd25, 0);
      const sOther = otherTarget / crdOther;
      finalWeights = new Map<number, number>();
      laIdx.forEach((i, k) => finalWeights.set(i, wLA[k]! * sLA));
      otherIdx.forEach((i) => finalWeights.set(i, drafts[i]!.base * sOther));
      let ff24 = 0;
      drafts.forEach((d, i) => (ff24 += (d.group === 'NEW' ? 1 : finalWeights.get(i)!) * m[i]!.ff24));
      st.metrics['loanFf24'] = ff24;
      const otherFf = otherIdx.reduce((s, i) => s + finalWeights.get(i)! * m[i]!.ff24, 0);
      const gap = ff24Target - ff24;
      if (Math.abs(gap) < 2_000_00 || iter === 5) break;
      fixedScale = Math.max(0.7, Math.min(4, fixedScale * (1 + gap / Math.max(1, otherFf))));
    }
    const mm = drafts.map((d) => metrics(d.loan, history, flatRate));
    let remb25 = 0;
    let remb24 = 0;
    drafts.forEach((d, i) => {
      const w = d.group === 'NEW' ? 1 : finalWeights.get(i)!;
      remb25 += w * mm[i]!.remb25;
      remb24 += w * mm[i]!.remb24;
    });
    st.metrics['fixedRateScale'] = fixedScale;
    return { weights: finalWeights, remb25, remb24 };
  };
  const rembTarget = eur(cal.clean['2025']!['loanRepayments']!.value!);
  let best = { ext: st.levers.loanExtensionYears, gap: 0 };
  if (best.ext < 0) {
    best = { ext: 0, gap: Infinity };
    for (let ext = 0; ext <= 20; ext++) {
      const r = calibrate(ext);
      const gap = Math.abs(r.remb25 - rembTarget);
      if (gap < best.gap) best = { ext, gap };
    }
  }
  st.metrics['loanExtensionYears'] = best.ext;
  const finalWeights = calibrate(best.ext).weights;
  for (const [i, w] of finalWeights) drafts[i]!.loan.refOutstanding = Math.round(UNIT * w);

  for (const d of drafts) {
    const loan = d.loan;
    if (d.group !== 'NEW') {
      const ageYears = 2023 - Number(loan.startDate.slice(0, 4));
      loan.principal = Math.round((loan.refOutstanding * (1 + Math.min(1.6, ageYears * 0.035))) / 100) * 100;
    }
    const schedule = buildSchedule(loan, history, SCHEDULE_UNTIL);
    st.loans.push(loan);
    st.schedules.set(loan.id, schedule);
  }
}

/** Sum of outstanding capital by account at a date. */
export function outstandingByAccount(st: GenState, date: string): Map<string, Cents> {
  const m = new Map<string, Cents>();
  for (const loan of st.loans) {
    const crd = outstandingAt(loan, st.schedules.get(loan.id)!, date);
    m.set(loan.account, (m.get(loan.account) ?? 0) + crd);
  }
  return m;
}

export function flatRateIcneError(st: GenState, date: string, flatRate: number): Cents {
  let e = 0;
  for (const loan of st.loans) {
    if (loan.rate.kind !== 'livretA') continue;
    const s = st.schedules.get(loan.id)!;
    e += accruedInterest(loan, s, date, flatRate) - accruedInterest(loan, s, date);
  }
  return e;
}
