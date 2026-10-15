/** §3.4 — integrity of the clean world (bloquant). */
import { describe, expect, it } from 'vitest';
import { closingBalances, closingBalancesByAux, OPENING_JOURNAL, trialBalance } from '../../src/engine/balance';
import { buildFec } from '../../src/engine/fec';
import { checkLedger } from '../../src/engine/ledger';
import { buildStatements } from '../../src/engine/statements';
import { params, world } from '../helpers/world';

describe('ledgers', () => {
  const { world: w } = world();
  for (const key of ['prior', 'current'] as const) {
    const ledger = w.ledgers[key];
    it(`${key}: every entry is balanced, dated in the year, with integer cents`, () => {
      expect(checkLedger(ledger)).toEqual([]);
    });
    it(`${key}: the trial balance is balanced and every account exists in the chart`, () => {
      const tb = trialBalance(ledger, w.chart);
      expect(tb.totals.closing).toBe(0);
      expect(tb.totals.debit).toBe(tb.totals.credit);
      const accounts = new Set(w.chart.accounts.map((a) => a.number));
      expect(tb.rows.filter((r) => !accounts.has(r.account)).map((r) => r.account)).toEqual([]);
    });
    it(`${key}: FEC = general ledger = trial balance`, () => {
      const fec = buildFec(ledger, w.chart, w.journals, w.auxiliaries);
      const lines = ledger.entries.reduce((s, e) => s + e.lines.length, 0);
      expect(fec).toHaveLength(lines);
      const byAccount = new Map<string, number>();
      for (const l of fec) byAccount.set(l.CompteNum, (byAccount.get(l.CompteNum) ?? 0) + l.debitCents - l.creditCents);
      const balances = closingBalances(ledger);
      for (const [a, b] of balances) expect(byAccount.get(a) ?? 0).toBe(b);
      // the opening entries (à-nouveaux) open the file, then validation order
      const an = fec.filter((l) => l.JournalCode === OPENING_JOURNAL).length;
      expect(an).toBeGreaterThan(0);
      expect(fec.slice(0, an).every((l) => l.JournalCode === OPENING_JOURNAL)).toBe(true);
      for (let i = an + 1; i < fec.length; i++) expect(fec[i - 1]!.validDate <= fec[i]!.validDate || fec[i]!.entryId === fec[i - 1]!.entryId).toBe(true);
      // continuous numbering per journal
      for (const j of w.journals) {
        const nums = [...new Set(fec.filter((l) => l.JournalCode === j.code).map((l) => l.EcritureNum))];
        nums.forEach((n, i) => expect(n).toBe(`${j.code}${String(i + 1).padStart(6, '0')}`));
      }
    });
  }
  it('the FEC of 2025 has between 25 000 and 40 000 lines', () => {
    const lines = w.ledgers.current.entries.reduce((s, e) => s + e.lines.length, 0);
    expect(lines).toBeGreaterThanOrEqual(25_000);
    expect(lines).toBeLessThanOrEqual(40_000);
  });
  it('the 2025 opening equals the 2024 closing (balance-sheet accounts, by auxiliary)', () => {
    const closing = closingBalancesByAux(w.ledgers.prior);
    const an = w.ledgers.current.entries.find((e) => e.journal === 'AN')!;
    const opening = new Map<string, number>();
    for (const l of an.lines) opening.set(`${l.account}|${l.aux ?? ''}`, (opening.get(`${l.account}|${l.aux ?? ''}`) ?? 0) + l.debit - l.credit);
    let result = 0;
    for (const [k, b] of closing) {
      const [a] = k.split('|') as [string];
      if (a.startsWith('6') || a.startsWith('7')) result -= b;
      else if (a !== '120') expect(opening.get(k) ?? 0, k).toBe(b);
    }
    expect(opening.get('120|')).toBe(-result);
  });
});

describe('financial statements', () => {
  const { world: w } = world();
  const fs = buildStatements({ defs: params().statements, chart: w.chart, current: closingBalances(w.ledgers.current), prior: closingBalances(w.ledgers.prior), currentYear: 2025, priorYear: 2024, presentation: w.presentation });
  it('assets = liabilities (2025 and 2024)', () => {
    expect(fs.checks.assetsTotal).toBe(fs.checks.liabilitiesTotal);
    expect(fs.checks.priorAssetsTotal).toBe(fs.checks.priorLiabilitiesTotal);
  });
  it('result of the income statement = result in the balance sheet', () => {
    expect(fs.checks.incomeStatementResult).toBe(fs.checks.balanceSheetResult);
    expect(fs.lines['CR_RESULTAT']!.prior).toBe(fs.lines['P_RESULTAT']!.prior);
  });
  it('the N-1 column equals the certified 2024 statements', () => {
    const fs24 = buildStatements({ defs: params().statements, chart: w.chart, current: closingBalances(w.ledgers.prior), prior: new Map(), currentYear: 2024, priorYear: 2023, presentation: w.presentation });
    for (const [id, v] of Object.entries(fs.lines)) expect(v.prior, id).toBe(fs24.lines[id]!.current);
  });
});
