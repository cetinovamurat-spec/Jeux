/** Trial balance, account balances and opening entries. */
import { accountMap, isIncomeStatementAccount } from './chart';
import type { Cents } from './money';
import type { ChartOfAccounts, EntryLine, JournalEntry, Ledger, TrialBalance, TrialBalanceRow } from './types';

export const OPENING_JOURNAL = 'AN';

/** Closing balance per account (debit positive). */
export function closingBalances(ledger: Ledger): Map<string, Cents> {
  const m = new Map<string, Cents>();
  for (const e of ledger.entries) {
    for (const l of e.lines) m.set(l.account, (m.get(l.account) ?? 0) + l.debit - l.credit);
  }
  return m;
}

/** Closing balance per account and auxiliary account ('account|aux'). */
export function closingBalancesByAux(ledger: Ledger): Map<string, Cents> {
  const m = new Map<string, Cents>();
  for (const e of ledger.entries) {
    for (const l of e.lines) {
      const key = `${l.account}|${l.aux ?? ''}`;
      m.set(key, (m.get(key) ?? 0) + l.debit - l.credit);
    }
  }
  return m;
}

export function trialBalance(ledger: Ledger, chart: ChartOfAccounts): TrialBalance {
  const accounts = accountMap(chart);
  const rows = new Map<string, TrialBalanceRow>();
  const row = (account: string): TrialBalanceRow => {
    let r = rows.get(account);
    if (!r) {
      r = { account, label: accounts.get(account)?.label ?? '(compte inconnu)', opening: 0, debit: 0, credit: 0, closing: 0 };
      rows.set(account, r);
    }
    return r;
  };
  for (const e of ledger.entries) {
    const opening = e.journal === OPENING_JOURNAL;
    for (const l of e.lines) {
      const r = row(l.account);
      if (opening) r.opening += l.debit - l.credit;
      else {
        r.debit += l.debit;
        r.credit += l.credit;
      }
    }
  }
  const sorted = [...rows.values()].sort((a, b) => (a.account < b.account ? -1 : a.account > b.account ? 1 : 0));
  const totals = { opening: 0, debit: 0, credit: 0, closing: 0 };
  for (const r of sorted) {
    r.closing = r.opening + r.debit - r.credit;
    totals.opening += r.opening;
    totals.debit += r.debit;
    totals.credit += r.credit;
    totals.closing += r.closing;
  }
  return { fiscalYear: ledger.fiscalYear, rows: sorted, totals };
}

/** Net result of the year (credit positive = profit). */
export function netResult(balances: ReadonlyMap<string, Cents>): Cents {
  let r = 0;
  for (const [account, b] of balances) if (isIncomeStatementAccount(account)) r -= b;
  return r;
}

/** Sum of closing balances (debit positive) of accounts starting with any prefix. */
export function sumPrefixes(balances: ReadonlyMap<string, Cents>, prefixes: readonly string[], exclude: readonly string[] = []): Cents {
  let total = 0;
  for (const [account, b] of balances) {
    if (prefixes.some((p) => account.startsWith(p)) && !exclude.some((p) => account.startsWith(p))) total += b;
  }
  return total;
}

/**
 * Opening entry (à-nouveaux) of the next year: balance-sheet accounts keep their
 * closing balances (by auxiliary account), the result goes to 120 / 129.
 */
export function openingEntry(
  previous: Ledger,
  chart: ChartOfAccounts,
  next: { id: string; date: string; validDate: string; enteredBy: string },
): JournalEntry {
  const byAux = closingBalancesByAux(previous);
  const lines: EntryLine[] = [];
  const keys = [...byAux.keys()].sort();
  for (const key of keys) {
    const [account, aux] = key.split('|') as [string, string];
    if (isIncomeStatementAccount(account)) continue;
    const b = byAux.get(key) ?? 0;
    if (b === 0) continue;
    const base = aux ? { aux } : {};
    lines.push(b > 0 ? { account, debit: b, credit: 0, ...base } : { account, debit: 0, credit: -b, ...base });
  }
  const result = netResult(closingBalances(previous));
  if (result !== 0) lines.push(result > 0 ? { account: '120', debit: 0, credit: result } : { account: '129', debit: -result, credit: 0 });
  void chart;
  return {
    id: next.id,
    journal: OPENING_JOURNAL,
    date: next.date,
    label: `À-nouveaux au ${next.date.slice(8, 10)}/${next.date.slice(5, 7)}/${next.date.slice(0, 4)}`,
    pieceRef: `AN${next.date.slice(0, 4)}`,
    pieceDate: next.date,
    lines,
    validDate: next.validDate,
    enteredBy: next.enteredBy,
    origin: 'gen:opening',
  };
}
