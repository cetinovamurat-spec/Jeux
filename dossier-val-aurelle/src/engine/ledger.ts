/** Entry builders and checks. */
import type { Cents } from './money';
import type { EntryLine, JournalEntry, Ledger } from './types';

type LineOptions = Omit<EntryLine, 'account' | 'debit' | 'credit'>;

/** Debit line (a negative amount becomes a credit). */
export function debit(account: string, amount: Cents, options: LineOptions = {}): EntryLine {
  return amount >= 0
    ? { account, debit: amount, credit: 0, ...options }
    : { account, debit: 0, credit: -amount, ...options };
}

/** Credit line (a negative amount becomes a debit). */
export function credit(account: string, amount: Cents, options: LineOptions = {}): EntryLine {
  return amount >= 0
    ? { account, debit: 0, credit: amount, ...options }
    : { account, debit: -amount, credit: 0, ...options };
}

/** Drops zero lines and nets each line to a single side. */
export function cleanLines(lines: readonly EntryLine[]): EntryLine[] {
  const out: EntryLine[] = [];
  for (const l of lines) {
    const net = l.debit - l.credit;
    if (net === 0) continue;
    out.push(net > 0 ? { ...l, debit: net, credit: 0 } : { ...l, debit: 0, credit: -net });
  }
  return out;
}

export function entryTotals(entry: JournalEntry): { debit: Cents; credit: Cents } {
  let d = 0;
  let c = 0;
  for (const l of entry.lines) {
    d += l.debit;
    c += l.credit;
  }
  return { debit: d, credit: c };
}

/** Returns a list of problems (empty when the entry is valid). */
export function checkEntry(entry: JournalEntry): string[] {
  const problems: string[] = [];
  if (entry.lines.length < 2) problems.push(`${entry.id}: fewer than two lines`);
  for (const l of entry.lines) {
    if (!Number.isInteger(l.debit) || !Number.isInteger(l.credit)) problems.push(`${entry.id}: non-integer cents on ${l.account}`);
    if (l.debit < 0 || l.credit < 0) problems.push(`${entry.id}: negative amount on ${l.account}`);
    if (l.debit !== 0 && l.credit !== 0) problems.push(`${entry.id}: both sides on ${l.account}`);
  }
  const t = entryTotals(entry);
  if (t.debit !== t.credit) problems.push(`${entry.id}: unbalanced (D ${t.debit} / C ${t.credit})`);
  if (entry.validDate < entry.date && entry.journal !== 'AN') problems.push(`${entry.id}: validated before its date`);
  return problems;
}

export function checkLedger(ledger: Ledger): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const e of ledger.entries) {
    if (ids.has(e.id)) problems.push(`duplicate entry id ${e.id}`);
    ids.add(e.id);
    if (e.date < ledger.openingDate || e.date > ledger.closingDate) problems.push(`${e.id}: date ${e.date} outside the fiscal year`);
    problems.push(...checkEntry(e));
  }
  return problems;
}
