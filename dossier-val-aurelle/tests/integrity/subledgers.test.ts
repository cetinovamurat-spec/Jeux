/** §3.4 — the balance reconciles with every sub-ledger and with the annex tables. */
import { describe, expect, it } from 'vitest';
import { closingBalances, closingBalancesByAux, sumPrefixes } from '../../src/engine/balance';
import { accumulatedDepreciation, accumulatedSubsidyRelease } from '../../src/engine/subledgers/depreciation';
import { accruedInterest, outstandingAt } from '../../src/engine/subledgers/loans';
import { buildAnnex } from '../../src/scenario/annex';
import type { ScenarioDatasets } from '../../src/scenario/datasets';
import { postingDate, rentExcessByProgramme } from '../../src/scenario/generator/posting';
import { CLEAN_METHOD, managerReceivable, tenantAllowance } from '../../src/scenario/impairment';
import { params, world } from '../helpers/world';

const YEARS = [
  { key: 'prior' as const, end: '2024-12-31', yk: 'y2024' as const },
  { key: 'current' as const, end: '2025-12-31', yk: 'y2025' as const },
];

describe('balance ↔ sub-ledgers', () => {
  const r = world();
  const w = r.world;
  const ds = w.datasets as unknown as ScenarioDatasets;
  for (const { key, end, yk } of YEARS) {
    const b = closingBalances(w.ledgers[key]);
    const bal = (prefixes: string[]) => sumPrefixes(b, prefixes);
    describe(`${end}`, () => {
      it('fixed assets: gross and accumulated depreciation by account = register', () => {
        const gross = new Map<string, number>();
        const acc = new Map<string, number>();
        for (const c of ds.components) {
          if (!(c.inServiceDate <= end && !(c.disposal && c.disposal.date <= end))) continue;
          gross.set(c.account, (gross.get(c.account) ?? 0) + c.cost);
          if (c.usefulLifeYears > 0) acc.set(`28${c.account.slice(1)}`, (acc.get(`28${c.account.slice(1)}`) ?? 0) + accumulatedDepreciation(c, end));
        }
        for (const [a, x] of gross) expect(b.get(a) ?? 0, a).toBe(x);
        for (const [a, x] of acc) expect(-(b.get(a) ?? 0), a).toBe(x);
        expect(bal(['21', '20'])).toBe([...gross.values()].reduce((s, x) => s + x, 0));
      });
      it('investment subsidies, amounts released and receivables = subsidy register', () => {
        let granted = 0;
        let released = 0;
        let due = 0;
        for (const s of ds.subsidies) {
          if (s.decisionDate > end || (s.cancelledOn && s.cancelledOn <= end)) continue;
          granted += s.amount;
          released += accumulatedSubsidyRelease(s, ds.components, end);
          due += s.amount - s.receipts.filter((x) => x.date <= end).reduce((a, x) => a + x.amount, 0);
        }
        expect(-bal(['131'])).toBe(granted);
        expect(bal(['139'])).toBe(released);
        expect(bal(['441'])).toBe(due);
      });
      it('loans by account and accrued interest = debt schedule', () => {
        const byAccount = new Map<string, number>();
        let icne = 0;
        for (const loan of ds.loans) {
          const sch = ds.loanSchedules.filter((l) => l.loanId === loan.id);
          byAccount.set(loan.account, (byAccount.get(loan.account) ?? 0) + outstandingAt(loan, sch, end));
          icne += accruedInterest(loan, sch, end);
        }
        for (const [a, x] of byAccount) expect(-(b.get(a) ?? 0), a).toBe(x);
        expect(-bal(['1688'])).toBe(icne);
      });
      it('tenant accounts (present, former) and deposits = LOGIGES auxiliary', () => {
        const present = ds.leases.filter((l) => l.start <= end && (!l.end || l.end > end));
        const byTenant = new Map(ds.tenants.map((t) => [t.id, t]));
        const presentTotal = present.reduce((s, l) => s + (byTenant.get(l.tenantId)?.byYear[yk]?.balance ?? 0), 0);
        expect(bal(['4111', '4116', '4191'])).toBe(presentTotal);
        const former = ds.tenants.reduce((s, t) => s + (t.byYear[yk]?.category === 'former' ? t.byYear[yk]!.balance : 0), 0);
        expect(bal(['4115'])).toBe(former);
        const held = ds.tenants.reduce((s, t) => s + (t.byYear[yk]?.category === 'former' ? t.byYear[yk]!.depositHeld : 0), 0);
        expect(-bal(['1651'])).toBe(present.reduce((s, l) => s + l.deposit, 0) + held);
      });
      it('impairment of tenant receivables = allowance computed by the method of the annex', () => {
        let total = 0;
        for (const t of ds.tenants) total += tenantAllowance(t, yk, CLEAN_METHOD)?.amount ?? 0;
        expect(-bal(['4911', '4915', '4916'])).toBe(total);
        expect(0 - bal(['4914'])).toBe(Math.round(managerReceivable(params(), 'ACCUEIL_HORIZONS', end) * CLEAN_METHOD.managerRate));
        expect(bal(['4114'])).toBe(managerReceivable(params(), 'ACCUEIL_HORIZONS', end));
      });
      it('suppliers = unpaid invoices', () => {
        const unpaid = ds.invoices.filter((i) => (i.category === 'ouverture' || postingDate(i) <= end) && !(i.paidDate && i.paidDate <= end));
        const pay = unpaid.filter((i) => !i.lines.some((l) => l.account.startsWith('2'))).reduce((s, i) => s + i.total, 0);
        const fixed = unpaid.filter((i) => i.lines.some((l) => l.account.startsWith('2'))).reduce((s, i) => s + i.total, 0);
        expect(-bal(['4011'])).toBe(pay);
        expect(-bal(['4041'])).toBe(fixed);
        // by supplier
        const byAux = closingBalancesByAux(w.ledgers[key]);
        const sample = unpaid.find((i) => !i.lines.some((l) => l.account.startsWith('2')))!;
        const supplierUnpaid = unpaid.filter((i) => i.supplierId === sample.supplierId && !i.lines.some((l) => l.account.startsWith('2'))).reduce((s, i) => s + i.total, 0);
        expect(-(byAux.get(`4011|${sample.supplierId}`) ?? 0)).toBe(supplierUnpaid);
      });
      it('maintenance provision and regularisation receivable = maintenance plan and regularisation statement', () => {
        const pge = ds.pge.find((p) => `${p.year}-12-31` === end)!;
        expect(-bal(['1572'])).toBe(pge.closing);
        expect(ds.maintenancePlan.reduce((s, it) => s + it.provision[yk], 0)).toBe(pge.closing);
        const regul = ds.regularisations.filter((x) => `${x.year}-12-31` === end);
        expect(bal(['4181'])).toBe(regul.filter((x) => x.regularisation > 0).reduce((s, x) => s + x.regularisation, 0));
        const restitution = key === 'current' ? [...rentExcessByProgramme(r.state, 2025).values()].reduce((s, x) => s + x, 0) : 0;
        expect(-bal(['4196'])).toBe(regul.filter((x) => x.regularisation < 0).reduce((s, x) => s - x.regularisation, 0) + restitution);
      });
      it('annex tables reconcile with the balance', () => {
        const annex = buildAnnex(w, params(), key);
        for (const t of annex) {
          for (const row of t.rows) {
            if (!row.accounts.length) continue;
            const balance = sumPrefixes(b, row.accounts);
            if (t.id === 'immobilisations') expect(row.values['fin'], row.id).toBe(balance);
            if (t.id === 'amortissements' || t.id === 'provisions') expect(row.values['fin'], row.id).toBe(0 - balance);
            if (t.id === 'subventions') expect(row.values['net'], row.id).toBe(0 - balance);
            if (t.id === 'dettes') expect(row.values['montant'], row.id).toBe(0 - balance);
            if (t.id === 'creances') expect(row.values['net'], row.id).toBe(balance);
          }
          if (t.id === 'immobilisations') for (const row of t.rows) expect(row.values['debut']! + row.values['augmentations']! + row.values['virements']! - row.values['diminutions']!).toBe(row.values['fin']);
          if (t.id === 'dettes') for (const row of t.rows) expect(row.values['moinsUnAn']! + row.values['unACinqAns']! + row.values['plusCinqAns']!).toBe(row.values['montant']);
        }
        const transfers = annex.find((t) => t.id === 'immobilisations')!.rows.reduce((s, r) => s + r.values['virements']!, 0);
        expect(transfers).toBe(0);
      });
    });
  }
});
