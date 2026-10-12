/**
 * Posting of the clean ledgers 2024 and 2025 from the sub-ledgers.
 * Every balance-sheet account is the image of a sub-ledger, so the
 * reconciliation tests (balance ↔ sub-ledgers) hold by construction.
 */
import { addBusinessDays, addDays, businessDayOnOrAfter, endOfMonth, isoDate } from '../../engine/dates';
import { debit as D, credit as C } from '../../engine/ledger';
import { allocate, type Cents } from '../../engine/money';
import { accumulatedDepreciation, accumulatedSubsidyRelease } from '../../engine/subledgers/depreciation';
import { accruedInterest, outstandingAt } from '../../engine/subledgers/loans';
import type { AssetComponent, EntryLine, JournalEntry, Ledger } from '../../engine/types';
import type { Invoice, Lease } from '../datasets';
import { Book, eur, grantorAccounts, type GenState } from './core';
import { CLEAN_METHOD, allowances, impairmentMovements } from '../impairment';
import { depreciationLines, subsidyReleaseLines } from '../anomalies/closing';
import type { RentRoll } from './tenancy';

const YEARS = [2024, 2025] as const;
type YK = 'y2023' | 'y2024' | 'y2025';
const yk = (y: number): YK => (`y${y}` as YK);

export interface PostingContext {
  roll: RentRoll;
  prepaidInsurance: Map<number, Cents>;
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function lenderAux(st: GenState, lenderId: string): string {
  return st.thirdParties.find((t) => t.id === lenderId)?.aux ?? lenderId;
}

function depreciationAccount(account: string): string {
  return `28${account.slice(1)}`;
}

/** Posting date of an invoice: invoice date, or reception date when received the next year. */
export function postingDate(inv: Invoice): string {
  return inv.invoiceDate.slice(0, 4) === inv.receivedDate.slice(0, 4) ? inv.invoiceDate : inv.receivedDate;
}

function letterCode(n: number): string {
  let s = '';
  let x = n;
  do {
    s = String.fromCharCode(65 + (x % 26)) + s;
    x = Math.floor(x / 26) - 1;
  } while (x >= 0);
  return s.padStart(2, 'A');
}

function payableAccount(inv: Invoice): '4011' | '4041' {
  return inv.lines.some((l) => l.account.startsWith('2')) ? '4041' : '4011';
}

function activeAt(c: AssetComponent, date: string): boolean {
  return c.inServiceDate <= date && !(c.disposal && c.disposal.date <= date);
}

export { CLEAN_METHOD, tenantAllowance } from '../impairment';

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

export function postLedgers(st: GenState, ctx: PostingContext): { prior: Ledger; current: Ledger } {
  const books = new Map<number, Book>(YEARS.map((y) => [y, new Book(y)]));
  const users = st.params.scenario.users;
  const sc = st.params.scenario;
  const rng = st.rng.fork('posting');
  const v = (date: string, days: number) => addBusinessDays(date, days);
  const rentUser = (date: string) => (date < users.migrationDate ? users.rentInterfaceBefore : users.rentInterfaceAfter);
  const cfoAt = (date: string) => (date <= users.cfoBefore.until ? users.cfoBefore.id : users.cfo.id);
  const closingValid = (year: number, k: number) => addBusinessDays(isoDate(year + 1, 1, 12), k);
  const interfaceValid = (date: string) => (date < users.migrationDate ? v(endOfMonth(Number(date.slice(0, 4)), Number(date.slice(5, 7))), 3) : v(date, 1));
  const dates = (year: number, month: number, day: number) => businessDayOnOrAfter(isoDate(year, month, Math.min(day, 28)));
  const book = (y: number) => books.get(y)!;
  const letters = new Map<string, number>();
  const nextLetter = (aux: string) => {
    const n = letters.get(aux) ?? 0;
    letters.set(aux, n + 1);
    return letterCode(n);
  };

  // ======================= OPENING 01/01/2024 ===============================
  const open: EntryLine[] = [];
  const d23 = '2023-12-31';
  // fixed assets
  const gross = new Map<string, Cents>();
  const acc = new Map<string, Cents>();
  for (const c of st.components) {
    if (!activeAt(c, d23)) continue;
    gross.set(c.account, (gross.get(c.account) ?? 0) + c.cost);
    if (c.usefulLifeYears > 0) acc.set(depreciationAccount(c.account), (acc.get(depreciationAccount(c.account)) ?? 0) + accumulatedDepreciation(c, d23));
  }
  for (const [a, x] of gross) open.push(D(a, x));
  for (const [a, x] of acc) open.push(C(a, x));
  for (const w of st.wip) if (w.date <= d23) open.push(D(w.account, w.amount, { refs: [`prog:${w.programmeId}`] }));
  // subsidies
  for (const s of st.subsidies) {
    if (s.decisionDate > d23) continue;
    const ga = grantorAccounts(s.grantorId);
    open.push(C(ga.equity, s.amount, { refs: [`sub:${s.id}`] }));
    const released = accumulatedSubsidyRelease(s, st.components, d23);
    if (released) open.push(D(ga.released, released, { refs: [`sub:${s.id}`] }));
    const due = s.amount - s.receipts.filter((r) => r.date <= d23).reduce((a, r) => a + r.amount, 0);
    if (due) open.push(D(ga.receivable, due, { refs: [`sub:${s.id}`] }));
  }
  // loans and accrued interest
  for (const loan of st.loans) {
    const sch = st.schedules.get(loan.id)!;
    const crd = outstandingAt(loan, sch, d23);
    const aux = lenderAux(st, loan.lenderId);
    if (crd) open.push(C(loan.account, crd, { aux, refs: [`loan:${loan.id}`] }));
    const icne = accruedInterest(loan, sch, d23);
    if (icne) open.push(C('1688', icne, { aux, refs: [`loan:${loan.id}`] }));
  }
  // tenants
  const present = (date: string) => st.leases.filter((l) => l.start <= date && (!l.end || l.end > date));
  const tenantById = new Map(st.tenants.map((t) => [t.id, t]));
  const presentBalances = (key: YK, date: string) => {
    let nonProcPos = 0;
    let credit = 0;
    let proc = 0;
    for (const l of present(date)) {
      const t = tenantById.get(l.tenantId);
      const y = t?.byYear[key];
      if (!y) continue;
      if (y.category === 'procedure') proc += y.balance;
      else if (y.balance < 0) credit += -y.balance;
      else nonProcPos += y.balance;
    }
    return { nonProcPos, credit, proc };
  };
  const pb23 = presentBalances('y2023', d23);
  open.push(D('4111', pb23.nonProcPos), C('4191', pb23.credit), D('4116', pb23.proc));
  let former23 = 0;
  let held23 = 0;
  for (const t of st.tenants) {
    const y = t.byYear.y2023;
    if (y && y.category === 'former') {
      former23 += y.balance;
      held23 += y.depositHeld;
    }
  }
  open.push(D('4115', former23));
  const allow23 = allowances(st.tenants, 'y2023', CLEAN_METHOD);
  for (const [a, perTenant] of allow23) open.push(C(a, [...perTenant.values()].reduce((x, y) => x + y, 0)));
  const deposits23 = present(d23).reduce((s, l) => s + l.deposit, 0) + held23;
  open.push(C('1651', deposits23));
  // charges regularisation 2023 (billed in June 2024)
  const ob = sc.openingBalances2023;
  const family = st.programmes.filter((p) => p.kind === 'family' && p.id !== 'TIL');
  const regul2023 = allocate(eur(ob['chargesRegularisationReceivableEuros']!), family.map((p) => p.units));
  const regulByProg = new Map<number, Map<string, Cents>>();
  regulByProg.set(2023, new Map(family.map((p, i) => [p.id, regul2023[i]!])));
  open.push(D('4181', regul2023.reduce((a, b) => a + b, 0)));
  // suppliers
  const openInvoices = st.invoices.filter((i) => i.category === 'ouverture');
  for (const inv of openInvoices) open.push(C(payableAccount(inv), inv.total, { aux: inv.supplierId, refs: [`inv:${inv.id}`] }));
  const fnp2023 = st.invoices.filter((i) => i.serviceYear === 2023 && i.category !== 'ouverture');
  open.push(C('4081', fnp2023.reduce((s, i) => s + i.total, 0)));
  const payroll23 = eur(ob['payrollPayablesEuros']!);
  open.push(C('431', Math.round(payroll23 * 0.62)), C('437', payroll23 - Math.round(payroll23 * 0.62)));
  open.push(C('4282', eur(sc.payroll.paidLeaveProvisionEuros['2023']!)));
  open.push(D('486', ctx.prepaidInsurance.get(2023)!));
  const pge23 = st.maintenancePlan.reduce((s, it) => s + it.provision.y2023, 0);
  open.push(C('1572', pge23), C('1511', eur(sc.provisions.risks['2023'])));
  open.push(D('5124', eur(sc.treasury.termDepositsEuros['2023']!)), D('5121', eur(st.levers.openingCashEuros)));
  const history2023 = sc.history.find((h) => h.year === 2023)!;
  open.push(C('1013', eur(sc.entity.capitalEuros)), C('120', eur(history2023.netResultEuros)));
  const totalD = open.reduce((s, l) => s + l.debit, 0);
  const totalC = open.reduce((s, l) => s + l.credit, 0);
  open.push(C('1068', totalD - totalC));
  st.metrics['openingReserves'] = totalD - totalC;
  book(2024).add({ journal: 'AN', date: '2024-01-01', label: 'À-nouveaux au 01/01/2024', lines: open, validDate: '2024-02-20', enteredBy: users.chiefAccountant, stream: 'AN', pieceRef: 'AN2024', pieceDate: '2024-01-01' });

  // reversals of the 2023 accruals
  const rev24: EntryLine[] = [];
  for (const loan of st.loans) {
    const icne = accruedInterest(loan, st.schedules.get(loan.id)!, d23);
    if (icne) rev24.push(D('1688', icne, { aux: lenderAux(st, loan.lenderId) }), C('6611', icne));
  }
  book(2024).add({ journal: 'OD', date: '2024-01-01', label: 'Extourne des intérêts courus au 31/12/2023', lines: rev24, validDate: '2024-01-15', enteredBy: users.chiefAccountant, stream: 'EXT' });
  const fnpLines: EntryLine[] = [];
  for (const inv of fnp2023) for (const l of inv.lines) fnpLines.push(C(l.account, l.amount, l.programmeId ? { refs: [`prog:${l.programmeId}`] } : {}));
  fnpLines.push(D('4081', fnp2023.reduce((s, i) => s + i.total, 0)));
  book(2024).add({ journal: 'OD', date: '2024-01-01', label: 'Extourne des factures non parvenues au 31/12/2023', lines: fnpLines, validDate: '2024-01-15', enteredBy: users.chiefAccountant, stream: 'EXT' });
  book(2024).add({ journal: 'OD', date: '2024-01-01', label: 'Extourne des charges constatées d’avance au 31/12/2023', lines: [D('616', ctx.prepaidInsurance.get(2023)!), C('486', ctx.prepaidInsurance.get(2023)!)], validDate: '2024-01-15', enteredBy: users.chiefAccountant, stream: 'EXT' });
  book(2024).add({ journal: 'OD', date: '2024-01-01', label: 'Extourne du reclassement des soldes créditeurs de locataires', lines: [D('4191', pb23.credit), C('4111', pb23.credit)], validDate: '2024-01-15', enteredBy: users.chiefAccountant, stream: 'EXT' });

  // ======================= YEARLY FLOWS =====================================
  for (const year of YEARS) {
    const b = book(year);
    const key = yk(year);
    const prevKey = yk(year - 1);
    const yEnd = `${year}-12-31`;
    const yPrevEnd = `${year - 1}-12-31`;

    // --- rent interface, deposits, managers ---
    const tenantDebits = new Map<string, Cents[]>();
    const aplByMonth = new Array<Cents>(12).fill(0);
    for (const p of st.programmes) {
      const pp = st.progParams.get(p.id)!;
      const months = ctx.roll.get(p.id)!.get(year)!;
      const debits: Cents[] = [];
      months.forEach((mm, i) => {
        const date = isoDate(year, i + 1, 1);
        const ref = { refs: [`prog:${p.id}`] };
        if (p.kind === 'family') {
          const tenantShare = mm.rentsRegulated + mm.rentsOther + mm.commercial + mm.parking - mm.rls;
          b.add({
            journal: 'QT', date, label: `Quittancement ${String(i + 1).padStart(2, '0')}/${year} – loyers – ${p.name}`, stream: 'QTL',
            lines: [D('4111', tenantShare, ref), D('70491', mm.rls, ref), C('70411', mm.rentsRegulated, ref), C('70412', mm.rentsOther, ref), C('70414', mm.commercial, ref), C('70415', mm.parking, ref)],
            validDate: interfaceValid(date), enteredBy: rentUser(date), pieceRef: `QT${year}${String(i + 1).padStart(2, '0')}-${p.id}`, pieceDate: date,
          });
          b.add({ journal: 'QT', date, label: `Quittancement ${String(i + 1).padStart(2, '0')}/${year} – provisions pour charges – ${p.name}`, stream: 'QTC', lines: [D('4111', mm.chargeProvisions, ref), C('7031', mm.chargeProvisions, ref)], validDate: interfaceValid(date), enteredBy: rentUser(date), pieceRef: `QC${year}${String(i + 1).padStart(2, '0')}-${p.id}`, pieceDate: date });
          b.add({ journal: 'QT', date, label: `Tiers payant APL ${String(i + 1).padStart(2, '0')}/${year} – ${p.name}`, stream: 'QTA', lines: [D('4431', mm.apl, { aux: 'CAF', ...ref }), C('4111', mm.apl, ref)], validDate: interfaceValid(date), enteredBy: rentUser(date), pieceRef: `QA${year}${String(i + 1).padStart(2, '0')}-${p.id}`, pieceDate: date });
          if (mm.newDeposits) b.add({ journal: 'QT', date, label: `Dépôts de garantie des entrées ${String(i + 1).padStart(2, '0')}/${year} – ${p.name}`, stream: 'QTD', lines: [D('4111', mm.newDeposits, ref), C('1651', mm.newDeposits, ref)], validDate: interfaceValid(date), enteredBy: rentUser(date) });
          debits.push(tenantShare + mm.chargeProvisions + mm.newDeposits - mm.apl);
          aplByMonth[i] = aplByMonth[i]! + mm.apl;
        } else if (pp.managerId) {
          const fee = eur(pp.monthlyFeeEuros ?? 0);
          const aux = st.thirdParties.find((t) => t.id === pp.managerId)!.aux!;
          b.add({ journal: 'QT', date, label: `Redevance ${String(i + 1).padStart(2, '0')}/${year} – ${p.name}`, stream: 'QTR', lines: [D('4114', fee, { aux, ...ref }), C('70413', fee, ref)], validDate: v(date, 2), enteredBy: users.chiefAccountant, pieceRef: `RD${year}${String(i + 1).padStart(2, '0')}-${p.id}`, pieceDate: date });
          const stop = sc.residenceManagers[pp.managerId]?.stopsPayingFrom;
          if (!stop || date < stop) b.add({ journal: 'BQ', date: dates(year, i + 1, 15), label: `Règlement redevance ${String(i + 1).padStart(2, '0')}/${year} – ${st.thirdParties.find((t) => t.id === pp.managerId)!.name}`, stream: 'BQR', lines: [D('5121', fee), C('4114', fee, { aux, ...ref })], validDate: v(dates(year, i + 1, 15), 1), enteredBy: users.treasuryAccountant });
        }
      });
      if (p.kind === 'family') tenantDebits.set(p.id, debits);
    }
    aplByMonth.forEach((apl, i) => b.add({ journal: 'BQ', date: dates(year, i + 1, 6), label: `Versement APL tiers payant ${String(i + 1).padStart(2, '0')}/${year} – CAF`, stream: 'BQA', lines: [D('5121', apl), C('4431', apl, { aux: 'CAF' })], validDate: v(dates(year, i + 1, 6), 1), enteredBy: users.treasuryAccountant }));

    // --- departures: deposits imputed / refunded, transfer to former tenants ---
    const departureCredits = new Map<string, Cents>();
    const refundsByMonth = new Array<Cents>(13).fill(0);
    const byProgMonth = new Map<string, { imputed: Cents; transferred: Cents }>();
    for (const l of st.leases) {
      if (!l.end || !l.end.startsWith(`${year}-`)) continue;
      const t = tenantById.get(l.tenantId);
      const month = Number(l.end.slice(5, 7));
      if (t?.departure && t.departure.date === l.end) {
        const k = `${l.programmeId}|${month}`;
        const e = byProgMonth.get(k) ?? { imputed: 0, transferred: 0 };
        e.imputed += l.deposit - t.departure.depositHeld;
        e.transferred += t.departure.balance;
        byProgMonth.set(k, e);
        departureCredits.set(l.programmeId, (departureCredits.get(l.programmeId) ?? 0) + l.deposit - t.departure.depositHeld + t.departure.balance);
      } else {
        refundsByMonth[month] = refundsByMonth[month]! + l.deposit;
      }
    }
    for (const [k, e] of byProgMonth) {
      const [pid, m] = k.split('|') as [string, string];
      const date = endOfMonth(year, Number(m));
      const ref = { refs: [`prog:${pid}`] };
      b.add({ journal: 'QT', date, label: `Sorties ${m.padStart(2, '0')}/${year} – imputation des dépôts de garantie – ${st.progParams.get(pid)!.name}`, stream: 'QTS', lines: [D('1651', e.imputed, ref), C('4111', e.imputed, ref)], validDate: interfaceValid(date), enteredBy: rentUser(date) });
      b.add({ journal: 'QT', date, label: `Sorties ${m.padStart(2, '0')}/${year} – transfert en comptes de locataires partis – ${st.progParams.get(pid)!.name}`, stream: 'QTS', lines: [D('4115', e.transferred, ref), C('4111', e.transferred, ref)], validDate: interfaceValid(date), enteredBy: rentUser(date) });
    }
    refundsByMonth.forEach((amount, m) => {
      if (!amount || m === 0) return;
      const date = m === 12 ? dates(year, 12, 29) : dates(year, m + 1, 10);
      b.add({ journal: 'BQ', date, label: `Restitution des dépôts de garantie – sorties ${String(m).padStart(2, '0')}/${year}`, stream: 'BQG', lines: [D('1651', amount), C('5121', amount)], validDate: v(date, 1), enteredBy: users.treasuryAccountant });
    });

    // --- charges regularisation of the previous year, billed in June ---
    const prevRegul = year === 2024 ? regulByProg.get(2023)! : new Map(st.regularisations.filter((r) => r.year === 2023 + (year - 2024)).map((r) => [r.programmeId, r.regularisation] as [string, Cents]));
    const regulBilling = new Map<string, Cents>();
    for (const [pid, amount] of prevRegul) {
      if (!amount) continue;
      const date = isoDate(year, 6, 14);
      const ref = { refs: [`prog:${pid}`] };
      b.add({
        journal: 'QT', date, label: `Régularisation des charges ${year - 1} – ${st.progParams.get(pid)!.name}`, stream: 'QTG',
        lines: amount > 0 ? [D('4111', amount, ref), C('4181', amount, ref)] : [D('4196', -amount, ref), C('4111', -amount, ref)],
        validDate: interfaceValid(date), enteredBy: rentUser(date),
      });
      regulBilling.set(pid, amount);
    }

    // --- debt discharge (rétablissement personnel) written off in 2025 ---
    const dischargeByProg = new Map<string, Cents>();
    for (const t of st.tenants) {
      if (t.writeOff?.reason === 'debtDischarge' && t.writeOff.date.startsWith(`${year}-`)) dischargeByProg.set(t.programmeId, (dischargeByProg.get(t.programmeId) ?? 0) + t.writeOff.amount);
    }
    if (dischargeByProg.size) {
      const date = sc.tenants.debtDischargeWriteOffDate;
      const lines: EntryLine[] = [];
      for (const [pid, amount] of dischargeByProg) lines.push(C('4111', amount, { refs: [`prog:${pid}`] }));
      lines.push(D('6541', [...dischargeByProg.values()].reduce((a, x) => a + x, 0)));
      b.add({ journal: 'OD', date, label: 'Effacement de dettes – procédures de rétablissement personnel (décisions 2025)', stream: 'ODL', lines, validDate: v(date, 3), enteredBy: users.chiefAccountant });
    }

    // --- tenant receipts: present balances identity by programme ---
    const openBal = new Map<string, Cents>();
    const closeBal = new Map<string, Cents>();
    for (const l of present(yPrevEnd)) {
      const y = tenantById.get(l.tenantId)?.byYear[prevKey];
      if (y) openBal.set(l.programmeId, (openBal.get(l.programmeId) ?? 0) + y.balance);
    }
    for (const l of present(yEnd)) {
      const y = tenantById.get(l.tenantId)?.byYear[key];
      if (y) closeBal.set(l.programmeId, (closeBal.get(l.programmeId) ?? 0) + y.balance);
    }
    const receipts = new Map<string, Cents[]>();
    for (const [pid, debits] of tenantDebits) {
      const totalDebits = debits.reduce((a, x) => a + x, 0) + Math.max(0, regulBilling.get(pid) ?? 0);
      const otherCredits = (departureCredits.get(pid) ?? 0) + (dischargeByProg.get(pid) ?? 0) + Math.max(0, -(regulBilling.get(pid) ?? 0));
      const total = (openBal.get(pid) ?? 0) + totalDebits - otherCredits - (closeBal.get(pid) ?? 0);
      receipts.set(pid, allocate(total, debits.map((d) => Math.max(1, d))));
    }
    // receipts: two direct-debit runs, cheque/transfer remittances every few business days, card payments weekly
    const modes: [number, string, number][] = [
      [5, 'Prélèvements automatiques', 0.24],
      [10, 'Prélèvements automatiques (2e échéance)', 0.14],
      [2, 'Remise de chèques et virements reçus', 0.05],
      [6, 'Remise de chèques et virements reçus', 0.06],
      [9, 'Remise de chèques et virements reçus', 0.05],
      [13, 'Remise de chèques et virements reçus', 0.06],
      [16, 'Remise de chèques et virements reçus', 0.06],
      [20, 'Remise de chèques et virements reçus', 0.06],
      [23, 'Remise de chèques et virements reçus', 0.05],
      [27, 'Remise de chèques et virements reçus', 0.05],
      [8, 'Paiements par carte et TIP', 0.04],
      [15, 'Paiements par carte et TIP', 0.04],
      [22, 'Paiements par carte et TIP', 0.05],
      [28, 'Paiements par carte et TIP', 0.05],
    ];
    for (let m = 0; m < 12; m++) {
      const perMode = new Map<number, EntryLine[]>();
      for (const [pid, months] of receipts) {
        const parts = allocate(months[m]!, modes.map((x) => x[2] * rng.uniform(0.9, 1.1)));
        parts.forEach((amount, k) => {
          if (!perMode.has(k)) perMode.set(k, []);
          perMode.get(k)!.push(C('4111', amount, { refs: [`prog:${pid}`] }));
        });
      }
      for (const [k, lines] of perMode) {
        const total = lines.reduce((s, l) => s + l.credit - l.debit, 0);
        const date = dates(year, m + 1, modes[k]![0]);
        b.add({ journal: 'BQ', date, label: `Encaissements locataires ${String(m + 1).padStart(2, '0')}/${year} – ${modes[k]![1]}`, stream: 'BQE', lines: [D('5121', total), ...lines], validDate: v(date, 1), enteredBy: rentUser(date), pieceRef: `ENC${year}${String(m + 1).padStart(2, '0')}-${String(k + 1).padStart(2, '0')}` });
      }
    }

    // --- former tenants: recoveries and write-offs ---
    const recoveries = st.tenants.reduce((s, t) => s + (t.recoveries?.filter((r) => r.year === year).reduce((a, r) => a + r.amount, 0) ?? 0), 0);
    allocate(recoveries, new Array(12).fill(1)).forEach((amount, m) => {
      const date = dates(year, m + 1, 25);
      b.add({ journal: 'BQ', date, label: `Recouvrement des créances de locataires partis ${String(m + 1).padStart(2, '0')}/${year}`, stream: 'BQX', lines: [D('5121', amount), C('4115', amount)], validDate: v(date, 1), enteredBy: users.treasuryAccountant });
    });
    const writeOffs = st.tenants.filter((t) => t.writeOff?.reason === 'irrecoverable' && t.writeOff.date.startsWith(`${year}-`));
    for (const q of [3, 6, 9, 12]) {
      const batch = writeOffs.filter((t) => Number(t.writeOff!.date.slice(5, 7)) === q);
      if (!batch.length) continue;
      const net = batch.reduce((s, t) => s + t.writeOff!.amount, 0);
      const held = batch.reduce((s, t) => s + (t.byYear[prevKey]?.depositHeld ?? 0), 0);
      const date = endOfMonth(year, q);
      b.add({ journal: 'OD', date, label: `Admission en non-valeur – créances irrécouvrables de locataires partis (${batch.length} dossiers)`, stream: 'ODL', lines: [D('6541', net), D('1651', held), C('4115', net + held)], validDate: v(date, 4), enteredBy: users.chiefAccountant, pieceRef: `ANV${year}-${q}` });
    }

    // --- supplier invoices and payments ---
    const posted = st.invoices.filter((i) => i.category !== 'ouverture' && postingDate(i).startsWith(`${year}-`));
    const letterOf = new Map<string, string>();
    for (const inv of posted) {
      const pa = payableAccount(inv);
      const paidSameYear = inv.paidDate && inv.paidDate.startsWith(`${year}-`);
      if (paidSameYear) letterOf.set(inv.id, nextLetter(inv.supplierId));
      const lines: EntryLine[] = inv.lines.map((l) => D(l.account, l.amount, l.programmeId ? { refs: [`prog:${l.programmeId}`, `inv:${inv.id}`] } : { refs: [`inv:${inv.id}`] }));
      const letter = letterOf.get(inv.id);
      lines.push(C(pa, inv.total, { aux: inv.supplierId, refs: [`inv:${inv.id}`], ...(letter ? { lettering: letter, letteringDate: inv.paidDate! } : {}) }));
      const date = postingDate(inv);
      b.add({ journal: 'AC', date, label: `${st.thirdParties.find((t) => t.id === inv.supplierId)?.name ?? inv.supplierId} – ${inv.description}`.slice(0, 120), stream: 'AC', lines, validDate: v(inv.receivedDate > date ? inv.receivedDate : date, rng.int(2, 6)), enteredBy: users.payablesAccountant, pieceRef: inv.number, pieceDate: inv.invoiceDate });
    }
    const toPay = st.invoices.filter((i) => i.paidDate && i.paidDate.startsWith(`${year}-`) && (i.category === 'ouverture' || postingDate(i) <= i.paidDate));
    const runs = new Map<string, Invoice[]>();
    for (const inv of toPay) runs.set(inv.paidDate!, [...(runs.get(inv.paidDate!) ?? []), inv]);
    for (const [date, invs] of [...runs.entries()].sort()) {
      const lines: EntryLine[] = invs.map((inv) => {
        const letter = letterOf.get(inv.id);
        return D(payableAccount(inv), inv.total, { aux: inv.supplierId, refs: [`inv:${inv.id}`], ...(letter ? { lettering: letter, letteringDate: date } : {}) });
      });
      const total = invs.reduce((s, i) => s + i.total, 0);
      lines.push(C('5121', total));
      b.add({ journal: 'BQ', date, label: `Règlements fournisseurs – virements du ${date.slice(8, 10)}/${date.slice(5, 7)}/${year}`, stream: 'BQF', lines, validDate: v(date, 1), enteredBy: users.treasuryAccountant, pieceRef: `VIR${date.replaceAll('-', '')}` });
    }

    // --- work in progress put into service ---
    const ops = new Set(st.wip.map((w) => w.operationId));
    for (const opId of ops) {
      const comps = st.components.filter((c) => c.operationId === opId && !c.id.includes('-OS7') && c.inServiceDate.startsWith(`${year}-`));
      if (!comps.length) continue;
      const items = st.wip.filter((w) => w.operationId === opId);
      const lines: EntryLine[] = [];
      const byAccount = new Map<string, Cents>();
      for (const c of comps) byAccount.set(c.account, (byAccount.get(c.account) ?? 0) + c.cost);
      for (const [a, x] of byAccount) lines.push(D(a, x, { refs: [`prog:${comps[0]!.programmeId}`] }));
      for (const acct of ['2312', '2313'] as const) {
        const x = items.filter((w) => w.account === acct).reduce((s, w) => s + w.amount, 0);
        if (x) lines.push(C(acct, x, { refs: [`prog:${comps[0]!.programmeId}`] }));
      }
      const date = comps[0]!.inServiceDate;
      const op = st.operations.find((o) => o.id === opId)!;
      b.add({ journal: 'OD', date, label: `Mise en service – ${op.label}`, stream: 'ODI', lines, validDate: v(date, 5), enteredBy: users.chiefAccountant, pieceRef: `MES-${opId}` });
    }

    // --- disposals (replacements, scrapping) during the year ---
    const disposed = st.components.filter((c) => c.disposal && c.disposal.date.startsWith(`${year}-`) && c.disposal.reason !== 'sale');
    for (const c of disposed) {
      const at = c.disposal!.date;
      const start = c.inServiceDate > yPrevEnd ? addDays(c.inServiceDate, -1) : yPrevEnd;
      const complement = accumulatedDepreciation(c, at) - accumulatedDepreciation(c, start);
      const accAt = accumulatedDepreciation(c, at);
      const nbv = c.cost - accAt;
      const da = depreciationAccount(c.account);
      const ref = { refs: [`comp:${c.id}`, `prog:${c.programmeId}`] };
      const lines: EntryLine[] = [];
      if (complement) lines.push(D('68111', complement, ref), C(da, complement, ref));
      lines.push(D(da, accAt, ref), D('6758', nbv, ref), C(c.account, c.cost, ref));
      b.add({ journal: 'OD', date: at, label: `Sortie de l’actif – ${c.label} (${c.disposal!.reason === 'replacement' ? 'composant remplacé' : 'mise au rebut'}) – ${c.building}`, stream: 'ODS', lines, validDate: v(at, 5), enteredBy: users.chiefAccountant });
    }
    // --- sales ---
    for (const s of st.sales.filter((x) => x.deedDate.startsWith(`${year}-`))) {
      const comps = st.components.filter((c) => s.componentIds.includes(c.id));
      const lines: EntryLine[] = [];
      let nbvTotal = 0;
      for (const c of comps) {
        const ref = { refs: [`comp:${c.id}`, `prog:${s.programmeId}`] };
        const da = depreciationAccount(c.account);
        if (c.usefulLifeYears > 0) {
          const start = c.inServiceDate > yPrevEnd ? addDays(c.inServiceDate, -1) : yPrevEnd;
          const complement = accumulatedDepreciation(c, s.deedDate) - accumulatedDepreciation(c, start);
          const accAt = accumulatedDepreciation(c, s.deedDate);
          if (complement) lines.push(D('68111', complement, ref), C(da, complement, ref));
          lines.push(D(da, accAt, ref));
          nbvTotal += c.cost - accAt;
        } else nbvTotal += c.cost;
        lines.push(C(c.account, c.cost, ref));
      }
      lines.push(D('6752', nbvTotal, { refs: [`prog:${s.programmeId}`] }));
      lines.push(D('462', s.price, { aux: lenderAux(st, s.notaryId), refs: [`prog:${s.programmeId}`] }), C('7752', s.price, { refs: [`prog:${s.programmeId}`] }));
      b.add({ journal: 'OD', date: s.deedDate, label: `Vente HLM – ${st.progParams.get(s.programmeId)!.name} – logement ${s.dwellingIds[0]} – acte du ${s.deedDate.slice(8, 10)}/${s.deedDate.slice(5, 7)}/${year}`, stream: 'ODV', lines, validDate: v(s.deedDate, 6), enteredBy: users.chiefAccountant, pieceRef: `ACTE-${s.id}`, pieceDate: s.deedDate });
      b.add({ journal: 'BQ', date: s.paymentDate, label: `Versement du notaire – vente ${s.id}`, stream: 'BQV', lines: [D('5121', s.price), C('462', s.price, { aux: lenderAux(st, s.notaryId) })], validDate: v(s.paymentDate, 1), enteredBy: users.treasuryAccountant });
    }

    // --- subsidies: notifications, receipts, lapse ---
    for (const s of st.subsidies) {
      const ga = grantorAccounts(s.grantorId);
      const ref = { refs: [`sub:${s.id}`, `prog:${s.programmeId}`] };
      if (s.decisionDate.startsWith(`${year}-`)) b.add({ journal: 'OD', date: s.decisionDate, label: `Notification de subvention – ${s.id}`, stream: 'ODG', lines: [D(ga.receivable, s.amount, ref), C(ga.equity, s.amount, ref)], validDate: v(s.decisionDate, 5), enteredBy: users.chiefAccountant });
      for (const r of s.receipts) if (r.date.startsWith(`${year}-`)) b.add({ journal: 'BQ', date: r.date, label: `Encaissement de subvention – ${s.id}`, stream: 'BQS', lines: [D('5121', r.amount), C(ga.receivable, r.amount, ref)], validDate: v(r.date, 1), enteredBy: users.treasuryAccountant });
      if (s.cancelledOn && s.cancelledOn.startsWith(`${year}-`)) {
        const received = s.receipts.filter((r) => r.date <= s.cancelledOn!).reduce((a, r) => a + r.amount, 0);
        b.add({ journal: 'OD', date: s.cancelledOn, label: `Caducité de la subvention ${s.id} (courrier du financeur)`, stream: 'ODG', lines: [D(ga.equity, s.amount, ref), C(ga.receivable, s.amount - received, ref), C('4671', received, ref)], validDate: v(s.cancelledOn, 5), enteredBy: users.chiefAccountant });
      }
    }

    // --- loans: due dates and drawdowns ---
    for (const loan of st.loans) {
      const aux = lenderAux(st, loan.lenderId);
      const ref = { aux, refs: [`loan:${loan.id}`] };
      for (const l of st.schedules.get(loan.id)!) {
        if (!l.dueDate.startsWith(`${year}-`)) continue;
        b.add({ journal: 'BQ', date: l.dueDate, label: `Échéance d’emprunt ${loan.contractNumber} – ${loan.product}`, stream: 'BQP', lines: [D(loan.account, l.principal, ref), D('6611', l.interest, { refs: [`loan:${loan.id}`] }), C('5121', l.principal + l.interest)], validDate: v(l.dueDate, 2), enteredBy: users.treasuryAccountant, pieceRef: `ECH-${loan.contractNumber}`, pieceDate: l.dueDate });
      }
      if (loan.refDate.startsWith(`${year}-`) && loan.refDate > '2023-12-31' && loan.principal === loan.refOutstanding) {
        b.add({ journal: 'BQ', date: loan.refDate, label: `Versement des fonds – emprunt ${loan.contractNumber} – ${loan.product}`, stream: 'BQN', lines: [D('5121', loan.refOutstanding), C(loan.account, loan.refOutstanding, ref)], validDate: v(loan.refDate, 2), enteredBy: users.treasuryAccountant, pieceRef: `CTR-${loan.contractNumber}` });
      }
    }

    // --- payroll ---
    for (const pm of st.payroll.filter((x) => x.year === year)) {
      const date = isoDate(year, pm.month, 25);
      const employer = pm.employerUrssaf + pm.employerPension + pm.employerOther;
      const urssaf = pm.employerUrssaf + Math.round(pm.employeeContributions * 0.7);
      const pension = employer + pm.employeeContributions - urssaf;
      b.add({ journal: 'PA', date, label: `Paie ${String(pm.month).padStart(2, '0')}/${year}`, stream: 'PA', lines: [D('6411', pm.gross), D('6413', pm.bonuses), D('6451', pm.employerUrssaf), D('6453', pm.employerPension), D('6458', pm.employerOther), C('421', pm.net), C('431', urssaf), C('437', pension)], validDate: v(date, 2), enteredBy: users.payrollInterface, pieceRef: `PAIE${year}${String(pm.month).padStart(2, '0')}` });
      const payDate = dates(year, pm.month, 28);
      b.add({ journal: 'BQ', date: payDate, label: `Virement des salaires ${String(pm.month).padStart(2, '0')}/${year}`, stream: 'BQW', lines: [D('421', pm.net), C('5121', pm.net)], validDate: v(payDate, 1), enteredBy: users.treasuryAccountant });
      if (pm.month < 12) {
        const socialDate = dates(year, pm.month + 1, 15);
        b.add({ journal: 'BQ', date: socialDate, label: `Cotisations sociales ${String(pm.month).padStart(2, '0')}/${year}`, stream: 'BQW', lines: [D('431', urssaf), D('437', pension), C('5121', urssaf + pension)], validDate: v(socialDate, 1), enteredBy: users.treasuryAccountant });
      }
    }
    // December social charges of the previous year
    const prevDec = year === 2024 ? { urssaf: Math.round(payroll23 * 0.62), pension: payroll23 - Math.round(payroll23 * 0.62) } : (() => {
      const pm = st.payroll.find((x) => x.year === 2024 && x.month === 12)!;
      const employer = pm.employerUrssaf + pm.employerPension + pm.employerOther;
      const urssaf = pm.employerUrssaf + Math.round(pm.employeeContributions * 0.7);
      return { urssaf, pension: employer + pm.employeeContributions - urssaf };
    })();
    b.add({ journal: 'BQ', date: dates(year, 1, 15), label: `Cotisations sociales 12/${year - 1}`, stream: 'BQW', lines: [D('431', prevDec.urssaf), D('437', prevDec.pension), C('5121', prevDec.urssaf + prevDec.pension)], validDate: v(dates(year, 1, 15), 1), enteredBy: users.treasuryAccountant });

    // --- property taxes ---
    const notices = st.taxNotices.filter((t) => t.year === year);
    const taxLines: EntryLine[] = [];
    for (const n of notices) {
      if (n.tfpb) taxLines.push(D('63512', n.tfpb, { refs: [`prog:${n.programmeId}`] }));
      if (n.teom) taxLines.push(D('63513', n.teom, { refs: [`prog:${n.programmeId}`] }));
    }
    const taxTotal = notices.reduce((s, n) => s + n.tfpb + n.teom, 0);
    taxLines.push(C('4471', taxTotal, { aux: 'DGFIP' }));
    b.add({ journal: 'OD', date: isoDate(year, 9, 10), label: `Avis de taxes foncières et de TEOM ${year}`, stream: 'ODT', lines: taxLines, validDate: v(isoDate(year, 9, 10), 4), enteredBy: users.chiefAccountant, pieceRef: `TF${year}` });
    b.add({ journal: 'BQ', date: dates(year, 10, 15), label: `Paiement des taxes foncières ${year}`, stream: 'BQT', lines: [D('4471', taxTotal, { aux: 'DGFIP' }), C('5121', taxTotal)], validDate: v(dates(year, 10, 15), 1), enteredBy: users.treasuryAccountant });
    const other = eur(sc.taxes.otherEuros[String(year)]!);
    b.add({ journal: 'BQ', date: dates(year, 3, 20), label: `Autres impôts et taxes ${year}`, stream: 'BQT', lines: [D('6358', other), C('5121', other)], validDate: v(dates(year, 3, 20), 1), enteredBy: users.treasuryAccountant });
    if (year === 2024) {
      const relief = eur(sc.taxes.reliefEuros['2024']!);
      b.add({ journal: 'BQ', date: '2024-06-20', label: 'Dégrèvement de TFPB pour travaux d’économie d’énergie (réclamation 2023)', stream: 'BQT', lines: [D('5121', relief), C('7718', relief)], validDate: v('2024-06-20', 1), enteredBy: users.treasuryAccountant });
    }

    // --- other income and charges, treasury ---
    const oi = sc.otherIncome;
    allocate(eur(oi.ancillaryEuros[String(year)]!), new Array(12).fill(1)).forEach((amount, m) => {
      const date = dates(year, m + 1, 18);
      b.add({ journal: 'BQ', date, label: `Produits des activités annexes ${String(m + 1).padStart(2, '0')}/${year} (refacturations, redevances d’antennes, frais de dossier)`, stream: 'BQO', lines: [D('5121', amount), C('7088', amount)], validDate: v(date, 1), enteredBy: users.treasuryAccountant });
    });
    const once = (date: string, label: string, lines: EntryLine[]) => b.add({ journal: 'BQ', date: businessDayOnOrAfter(date), label, stream: 'BQO', lines, validDate: v(businessDayOnOrAfter(date), 1), enteredBy: users.treasuryAccountant });
    const subs = eur(oi.operatingSubsidiesEuros[String(year)]!);
    once(isoDate(year, 6, 12), 'Subvention d’exploitation – accompagnement social', [D('5121', subs), C('741', subs)]);
    const misc = eur(oi.miscEuros[String(year)]!);
    once(isoDate(year, 12, 8), 'Produits divers de gestion courante', [D('5121', misc), C('758', misc)]);
    const indem = eur(oi.insuranceIndemnitiesEuros[String(year)]!);
    once(isoDate(year, 5, 21), 'Indemnités d’assurance – sinistres', [D('5121', indem), C('7718', indem)]);
    allocate(eur(sc.treasury.financialIncomeEuros[String(year)]!), [1.05, 1, 0.98, 0.97]).forEach((amount, q) => once(isoDate(year, q * 3 + 3, 28), `Intérêts des comptes à terme – ${q + 1}e trimestre ${year}`, [D('5121', amount), C('7681', amount)]));
    const oc = sc.otherCharges;
    once(isoDate(year, 7, 9), 'Pénalités et majorations', [D('6712', eur(oc.penaltiesEuros[String(year)]!)), C('5121', eur(oc.penaltiesEuros[String(year)]!))]);
    const reloc = eur(oc.relocationEuros[String(year)]!);
    allocate(reloc, year === 2025 ? [1, 1, 1, 1] : [1]).forEach((amount, k) => once(year === 2025 ? isoDate(2025, 9 + k, 20) : isoDate(year, 11, 20), 'Frais de relogement des locataires (aides au déménagement)', [D('6718', amount), C('5121', amount)]));
    once(isoDate(year, 10, 3), 'Charges diverses de gestion courante', [D('658', eur(oc.miscManagementEuros[String(year)]!)), C('5121', eur(oc.miscManagementEuros[String(year)]!))]);
    const dat = sc.treasury.termDepositsEuros;
    const datMove = eur(dat[String(year)]! - dat[String(year - 1)]!);
    if (datMove) b.add({ journal: 'BQ', date: dates(year, 3, 3), label: datMove > 0 ? 'Souscription de comptes à terme' : 'Remboursement de comptes à terme', stream: 'BQO', lines: [D('5124', datMove), C('5121', datMove)], validDate: v(dates(year, 3, 3), 1), enteredBy: users.treasuryAccountant });
    // allocation of the previous result by the general meeting
    const prevResult = year === 2024 ? eur(history2023.netResultEuros) : st.metrics['result2024']!;
    b.add({ journal: 'OD', date: isoDate(year, 6, 20), label: `Affectation du résultat ${year - 1} (assemblée générale)`, stream: 'ODA', lines: [D('120', prevResult), C('1068', prevResult)], validDate: v(isoDate(year, 6, 20), 3), enteredBy: users.chiefAccountant, pieceRef: `AG${year}` });
    if (year === 2025) {
      const adv = sc.specific.sisterAdvance;
      b.add({ journal: 'BQ', date: adv.date, label: 'Avance en compte courant – Coteaux du Serein Habitat (convention de soutien du 01/09/2025)', stream: 'BQO', lines: [D('2748', eur(adv.euros), { aux: 'CSH' }), C('5121', eur(adv.euros))], validDate: v(adv.date, 1), enteredBy: users.treasuryAccountant, pieceRef: 'CONV-CSH-2025' });
      // software migration: transfer of tenant balances to the new auxiliary structure (F7)
      for (const [i, p] of st.programmes.filter((x) => x.kind === 'family').entries()) {
        const amount = Math.max(0, closeBal.get(p.id) ?? 0) + 1;
        const date = users.migrationWeekend[i % 2]!;
        b.add({ journal: 'OD', date, label: `Reprise des soldes locataires – migration LOGIGES – ${p.name}`, stream: 'ODM', lines: [D('4111', amount, { aux: `LG2-${p.id}` }), C('4111', amount, { aux: `LOG-${p.id}` })], validDate: date, enteredBy: users.migration, pieceRef: `MIG-${p.id}` });
      }
    }
    // records the ledger result before closing entries (affectation of next year)

    // ======================= CLOSING ENTRIES ================================
    const cu = (k: number) => (year === 2024 ? (k % 2 ? users.chiefAccountant : cfoAt(closingValid(year, k))) : k % 2 ? users.chiefAccountant : users.cfo.id);
    // depreciation and subsidies released, one entry per programme (register of components)
    const programmeIds = [...new Set(st.components.map((c) => c.programmeId))].sort();
    for (const pid of programmeIds) {
      const lines = depreciationLines(st.components, pid, year);
      if (!lines.length) continue;
      const name = st.progParams.get(pid)?.name ?? 'Siège et moyens généraux';
      b.add({ journal: 'OD', date: yEnd, label: `Dotations aux amortissements ${year} – ${name}`, stream: 'CLO', lines, validDate: closingValid(year, 6), enteredBy: cu(1), pieceRef: `INV${year}-AMORT-${pid}` });
    }
    for (const pid of [...new Set(st.subsidies.map((s) => s.programmeId))].sort()) {
      const lines = subsidyReleaseLines(st.subsidies, st.components, pid, year);
      if (!lines.length) continue;
      b.add({ journal: 'OD', date: yEnd, label: `Quote-part des subventions virée au résultat ${year} – ${st.progParams.get(pid)?.name ?? pid}`, stream: 'CLO', lines, validDate: closingValid(year, 6), enteredBy: cu(1), pieceRef: `INV${year}-QPS-${pid}` });
    }
    // PGE
    const pge = st.pge.find((p) => p.year === year)!;
    b.add({ journal: 'OD', date: yEnd, label: `Provision pour gros entretien ${year} – dotation (plan pluriannuel d’entretien)`, stream: 'CLO', lines: [D('68157', pge.dotation), C('1572', pge.dotation)], validDate: closingValid(year, 8), enteredBy: cu(2), pieceRef: `INV${year}-PGE` });
    b.add({ journal: 'OD', date: yEnd, label: `Provision pour gros entretien ${year} – reprise (travaux réalisés)`, stream: 'CLO', lines: [D('1572', pge.reprise), C('78157', pge.reprise)], validDate: closingValid(year, 8), enteredBy: cu(2), pieceRef: `INV${year}-PGE` });
    // risks
    const rk = sc.provisions.risks;
    const rd = eur(rk.dotation[String(year)]!);
    const rr = eur(rk.reprise[String(year)]!);
    b.add({ journal: 'OD', date: yEnd, label: `Provisions pour litiges ${year}`, stream: 'CLO', lines: [D('68152', rd), C('1511', rd), D('1511', rr), C('78152', rr)], validDate: closingValid(year, 8), enteredBy: cu(1) });
    // receivables impairment (per tenant variations, method of the annex)
    const imp = impairmentMovements(st.tenants, st.params, year, CLEAN_METHOD);
    b.add({ journal: 'OD', date: yEnd, label: `Dépréciation des créances locatives ${year} (méthode décrite en annexe)`, stream: 'CLO', lines: imp.lines, validDate: closingValid(year, 9), enteredBy: cu(2), pieceRef: `INV${year}-DEPR` });
    st.metrics[`impairmentCharge${year}`] = imp.dotation;
    // accrued interest
    const icneLines: EntryLine[] = [];
    let icneTotal = 0;
    for (const loan of st.loans) {
      const x = accruedInterest(loan, st.schedules.get(loan.id)!, yEnd);
      if (!x) continue;
      icneLines.push(C('1688', x, { aux: lenderAux(st, loan.lenderId), refs: [`loan:${loan.id}`] }));
      icneTotal += x;
    }
    icneLines.push(D('6611', icneTotal));
    b.add({ journal: 'OD', date: yEnd, label: `Intérêts courus non échus au 31/12/${year} (état de la dette)`, stream: 'CLO', lines: icneLines, validDate: closingValid(year, 2), enteredBy: cu(1), pieceRef: `INV${year}-ICNE`, reverseNextYear: true });
    // invoices not received
    const fnp = st.invoices.filter((i) => i.serviceYear === year && postingDate(i) > yEnd);
    const fnpLines: EntryLine[] = [];
    for (const inv of fnp) for (const l of inv.lines) fnpLines.push(D(l.account, l.amount, l.programmeId ? { refs: [`prog:${l.programmeId}`] } : {}));
    fnpLines.push(C('4081', fnp.reduce((s, i) => s + i.total, 0)));
    b.add({ journal: 'OD', date: yEnd, label: `Factures non parvenues au 31/12/${year}`, stream: 'CLO', lines: fnpLines, validDate: closingValid(year, 12), enteredBy: cu(1), pieceRef: `INV${year}-FNP`, reverseNextYear: true });
    // OS n° 7 of Les Tilleuls (additional works due to the contractor)
    const os7 = st.components.filter((c) => c.id.includes('-OS7') && c.inServiceDate.startsWith(`${year}-`));
    if (os7.length) {
      const byAcc = new Map<string, Cents>();
      for (const c of os7) byAcc.set(c.account, (byAcc.get(c.account) ?? 0) + c.cost);
      const total = os7.reduce((s, c) => s + c.cost, 0);
      b.add({ journal: 'OD', date: yEnd, label: 'Les Tilleuls – travaux supplémentaires (ordre de service n° 7) dus à l’entreprise', stream: 'CLO', lines: [...[...byAcc.entries()].map(([a, x]) => D(a, x, { refs: ['prog:TIL'] })), C('4084', total, { aux: 'F0022' })], validDate: closingValid(year, 12), enteredBy: cu(2), pieceRef: 'OS7-TIL' });
    }
    // prepaid insurance
    const prepaid = ctx.prepaidInsurance.get(year)!;
    b.add({ journal: 'OD', date: yEnd, label: `Charges constatées d’avance au 31/12/${year} (assurances)`, stream: 'CLO', lines: [D('486', prepaid), C('616', prepaid)], validDate: closingValid(year, 3), enteredBy: cu(1), reverseNextYear: true });
    // charges regularisation
    const regLines: EntryLine[] = [];
    for (const r of st.regularisations.filter((x) => x.year === year)) {
      const ref = { refs: [`prog:${r.programmeId}`] };
      if (r.regularisation > 0) regLines.push(D('4181', r.regularisation, ref), C('7031', r.regularisation, ref));
      else if (r.regularisation < 0) regLines.push(D('7031', -r.regularisation, ref), C('4196', -r.regularisation, ref));
    }
    b.add({ journal: 'OD', date: yEnd, label: `Régularisation des charges récupérables ${year} (état par programme)`, stream: 'CLO', lines: regLines, validDate: closingValid(year, 10), enteredBy: cu(2), pieceRef: `INV${year}-REGUL` });
    // rent increase above the legal cap (+3,50 % voted, +3,26 % allowed): liability to the tenants
    const legal = st.params.regulatory.rentRevision.byYear[String(year)];
    if (legal?.votedByBoardPct && legal.votedByBoardPct > legal.legalCapPct) {
      const byProg = rentExcessByProgramme(st, year);
      const total = [...byProg.values()].reduce((x, y) => x + y, 0);
      if (total) b.add({ journal: 'OD', date: yEnd, label: `Dette de restitution aux locataires – hausse de loyers ${year} au-delà de la variation de l’IRL`, stream: 'CLO', lines: [...[...byProg.entries()].map(([pid, x]) => D('70411', x, { refs: [`prog:${pid}`] })), C('4196', total)], validDate: closingValid(year, 13), enteredBy: cu(2), pieceRef: `INV${year}-RESTIT` });
      st.metrics[`rentRestitution${year}`] = total;
    }
    // tenants: procedure reclass and credit balances
    const pbPrev = presentBalances(prevKey, yPrevEnd);
    const pbCur = presentBalances(key, yEnd);
    b.add({ journal: 'OD', date: yEnd, label: 'Reclassement des comptes de locataires en procédure', stream: 'CLO', lines: [D('4116', pbCur.proc - pbPrev.proc), C('4111', pbCur.proc - pbPrev.proc)], validDate: closingValid(year, 4), enteredBy: cu(1) });
    b.add({ journal: 'OD', date: yEnd, label: 'Reclassement des soldes créditeurs de locataires au passif', stream: 'CLO', lines: [D('4111', pbCur.credit), C('4191', pbCur.credit)], validDate: closingValid(year, 4), enteredBy: cu(1), reverseNextYear: true });
    // paid leave
    const pl = eur(sc.payroll.paidLeaveProvisionEuros[String(year)]!) - eur(sc.payroll.paidLeaveProvisionEuros[String(year - 1)]!);
    b.add({ journal: 'OD', date: yEnd, label: 'Ajustement de la provision pour congés payés', stream: 'CLO', lines: [D('6412', pl), C('4282', pl)], validDate: closingValid(year, 5), enteredBy: cu(1) });
    // property tax relief claimed in December 2025 (F2)
    if (year === 2025) {
      const relief = eur(sc.taxes.reliefEuros['2025']!);
      b.add({ journal: 'OD', date: yEnd, label: 'Produit à recevoir – dégrèvement de TFPB (réclamation du 15/12/2025)', stream: 'CLO', lines: [D('4487', relief), C('7718', relief)], validDate: closingValid(year, 11), enteredBy: cu(2), pieceRef: 'REC-TFPB-2025' });
    }

    // result of the year (for the allocation of next year)
    let res = 0;
    for (const e of b.entries) for (const l of e.lines) if (l.account.startsWith('6') || l.account.startsWith('7')) res += l.credit - l.debit;
    st.metrics[`result${year}`] = res;

    // opening of the next year
    if (year === 2024) {
      const b25 = book(2025);
      const priorLedger: Ledger = { fiscalYear: 2024, openingDate: '2024-01-01', closingDate: '2024-12-31', entries: b.entries };
      const balances = new Map<string, Cents>();
      for (const e of priorLedger.entries) for (const l of e.lines) {
        const k = `${l.account}|${l.aux ?? ''}`;
        balances.set(k, (balances.get(k) ?? 0) + l.debit - l.credit);
      }
      const lines: EntryLine[] = [];
      for (const [k, x] of [...balances.entries()].sort()) {
        const [a, aux] = k.split('|') as [string, string];
        if (a.startsWith('6') || a.startsWith('7') || x === 0) continue;
        lines.push(x > 0 ? D(a, x, aux ? { aux } : {}) : C(a, -x, aux ? { aux } : {}));
      }
      lines.push(C('120', res));
      b25.add({ journal: 'AN', date: '2025-01-01', label: 'À-nouveaux au 01/01/2025', lines, validDate: '2025-02-24', enteredBy: users.chiefAccountant, stream: 'AN', pieceRef: 'AN2025', pieceDate: '2025-01-01' });
      for (const e of b.reversals) {
        const swapped = e.lines.map((l) => ({ ...l, debit: l.credit, credit: l.debit }));
        b25.add({ journal: 'OD', date: '2025-01-01', label: `Extourne – ${e.label}`, stream: 'EXT', lines: swapped, validDate: '2025-01-20', enteredBy: users.chiefAccountant });
      }
    }
  }

  const toLedger = (year: number): Ledger => ({ fiscalYear: year, openingDate: `${year}-01-01`, closingDate: `${year}-12-31`, entries: book(year).entries as JournalEntry[] });
  return { prior: toLedger(2024), current: toLedger(2025) };
}

export type { Lease };

/** Rents invoiced in `year` above the legal increase, by programme (leases running on 1 January). */
export function rentExcessByProgramme(st: { leases: readonly Lease[]; params: GenState['params'] }, year: number): Map<string, Cents> {
  const rev = st.params.regulatory.rentRevision.byYear[String(year)]!;
  const m = new Map<string, Cents>();
  for (const l of st.leases) {
    if (!l.regulated || l.start > `${year}-01-01` || (l.end && l.end < `${year}-01-31`)) continue;
    const legalRent = Math.round(l.rent.y2024 * (1 + rev.legalCapPct / 100));
    const excess = l.rent.y2025 - legalRent;
    if (excess <= 0) continue;
    let months = 0;
    for (let mo = 1; mo <= 12; mo++) {
      if (l.start <= `${year}-${String(mo).padStart(2, '0')}-01` && (!l.end || l.end >= endOfMonth(year, mo))) months++;
    }
    m.set(l.programmeId, (m.get(l.programmeId) ?? 0) + excess * months);
  }
  return m;
}
