/**
 * Balance N / N-1 and general-ledger tools (§10.4): variations and filters of
 * the balance, ledger of one account (opening entries first, running
 * balance), grouping by auxiliary account. Pure, no React.
 *
 * Signed amounts follow the engine convention: debit positive, credit negative.
 */
import { OPENING_JOURNAL } from '../engine/balance';
import type { Cents } from '../engine/money';
import type { FecLineInternal } from '../engine/types';
import { fold } from './text';

// ---------------------------------------------------------------------------
// Balance N / N-1
// ---------------------------------------------------------------------------

/** One account of the balance N / N-1 (structurally identical to the UI's BalanceRow). */
export interface BalanceLine {
  account: string;
  label: string;
  /** Closing balance of the previous year. */
  prior: Cents;
  /** Opening entries of the year. */
  opening: Cents;
  /** Movements of the year, opening entries excluded. */
  debit: Cents;
  credit: Cents;
  closing: Cents;
}

export interface Variation {
  /** closing − prior */
  amount: Cents;
  /** amount / |prior|; null when the prior balance is zero. */
  ratio: number | null;
}

export function variation(prior: Cents, closing: Cents): Variation {
  const amount = closing - prior;
  return { amount, ratio: prior === 0 ? null : amount / Math.abs(prior) };
}

export interface BalanceFilter {
  /** Account prefix (digits) or words of the label, case-, accent- and ligature-insensitive. */
  text: string;
  /** Account class ('1' … '7'); '' for every class. */
  accountClass: string;
  /** Minimum absolute variation, in cents (null = off). */
  minVariation: Cents | null;
  /** Minimum absolute relative variation (0.1 = 10 %; null = off). A new account (prior 0) counts as an infinite variation. */
  minRatio: number | null;
  /** Hides accounts whose balance is zero at both closing dates. */
  hideSettled: boolean;
}

export const EMPTY_BALANCE_FILTER: Readonly<BalanceFilter> = { text: '', accountClass: '', minVariation: null, minRatio: null, hideSettled: false };

/**
 * Text match on an account: every word must match, a word made of digits as a
 * prefix of the account number, any other word inside the label.
 */
export function matchesAccount(account: string, label: string, text: string): boolean {
  const words = fold(text).split(/[\s–—-]+/).filter(Boolean);
  if (!words.length) return true;
  const folded = fold(label);
  return words.every((w) => (/^\d+$/.test(w) ? account.startsWith(w) : folded.includes(w)));
}

export function filterBalance<T extends BalanceLine>(rows: readonly T[], f: BalanceFilter): T[] {
  return rows.filter((r) => {
    if (f.accountClass && !r.account.startsWith(f.accountClass)) return false;
    if (f.hideSettled && r.prior === 0 && r.closing === 0) return false;
    const v = variation(r.prior, r.closing);
    if (f.minVariation !== null && Math.abs(v.amount) < f.minVariation) return false;
    if (f.minRatio !== null) {
      if (v.ratio === null ? v.amount === 0 : Math.abs(v.ratio) < f.minRatio) return false;
    }
    return matchesAccount(r.account, r.label, f.text);
  });
}

export interface BalanceTotals {
  count: number;
  prior: Cents;
  opening: Cents;
  debit: Cents;
  credit: Cents;
  closing: Cents;
}

export function balanceTotals(rows: readonly BalanceLine[]): BalanceTotals {
  const t: BalanceTotals = { count: rows.length, prior: 0, opening: 0, debit: 0, credit: 0, closing: 0 };
  for (const r of rows) {
    t.prior += r.prior;
    t.opening += r.opening;
    t.debit += r.debit;
    t.credit += r.credit;
    t.closing += r.closing;
  }
  return t;
}

/** A complete balance is balanced when the sum of its signed balances is zero (for each year). */
export function balanceCheck(rows: readonly BalanceLine[]): { prior: Cents; current: Cents; balanced: boolean } {
  const t = balanceTotals(rows);
  return { prior: t.prior, current: t.closing, balanced: t.prior === 0 && t.closing === 0 };
}

/** The `n` rows with the highest score (ties: account order), e.g. the most significant balances. */
export function topAccounts<T extends { account: string }>(rows: readonly T[], score: (r: T) => number, n: number): T[] {
  return rows
    .map((r) => ({ r, s: score(r) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || (a.r.account < b.r.account ? -1 : a.r.account > b.r.account ? 1 : 0))
    .slice(0, n)
    .map((x) => x.r);
}

/**
 * Parses a number typed by the player (fr-FR or plain: '1 234,5', '1234.5',
 * '-3'). Returns null for an empty text and NaN for an invalid one.
 */
export function parseDecimal(text: string): number | null {
  const t = text.replace(/[\s  ]/g, '').replace(/[−–]/g, '-').replace(',', '.');
  if (!t) return null;
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(t)) return Number.NaN;
  return Number(t);
}

// ---------------------------------------------------------------------------
// General ledger
// ---------------------------------------------------------------------------

export function isOpeningLine(line: FecLineInternal): boolean {
  return line.JournalCode === OPENING_JOURNAL;
}

/** Ledger order: opening entries first, then entry date, then entry number. */
export function compareLedgerLines(a: FecLineInternal, b: FecLineInternal): number {
  const ao = isOpeningLine(a);
  const bo = isOpeningLine(b);
  if (ao !== bo) return ao ? -1 : 1;
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.EcritureNum !== b.EcritureNum) return a.EcritureNum < b.EcritureNum ? -1 : 1;
  return 0;
}

/** Line indices of each account, in FEC order. */
export function accountLineIndex(lines: readonly FecLineInternal[]): Map<string, number[]> {
  const m = new Map<string, number[]>();
  lines.forEach((l, i) => {
    const list = m.get(l.CompteNum);
    if (list) list.push(i);
    else m.set(l.CompteNum, [i]);
  });
  return m;
}

export interface LedgerRow {
  /** Index of the line in the FEC of the year (entry panel, FEC links). */
  index: number;
  line: FecLineInternal;
  opening: boolean;
  /** Running balance after this line (debit positive). */
  balance: Cents;
}

export interface AccountLedger {
  account: string;
  rows: LedgerRow[];
  /** Totals of the lines, opening lines included. */
  debit: Cents;
  credit: Cents;
  /** Movements of the year (opening lines excluded), as in the balance. */
  movementDebit: Cents;
  movementCredit: Cents;
  /** Balance of the opening lines. */
  opening: Cents;
  /** Closing balance (debit positive). */
  balance: Cents;
}

/** Sum of one side of the opening lines. */
function sumSide(rows: readonly LedgerRow[], side: 'debitCents' | 'creditCents'): Cents {
  let total = 0;
  for (const r of rows) if (r.opening) total += r.line[side];
  return total;
}

function running(account: string, items: readonly { index: number; line: FecLineInternal }[]): AccountLedger {
  let balance = 0;
  let debit = 0;
  let credit = 0;
  let opening = 0;
  const rows = items.map(({ index, line }) => {
    const isOpening = isOpeningLine(line);
    debit += line.debitCents;
    credit += line.creditCents;
    balance += line.debitCents - line.creditCents;
    if (isOpening) opening += line.debitCents - line.creditCents;
    return { index, line, opening: isOpening, balance };
  });
  return { account, rows, debit, credit, movementDebit: debit - sumSide(rows, 'debitCents'), movementCredit: credit - sumSide(rows, 'creditCents'), opening, balance };
}

/**
 * Ledger of one account: its lines in ledger order with the running balance
 * and the totals. `indices` (from `accountLineIndex`) avoids a scan of the FEC.
 */
export function accountLedger(lines: readonly FecLineInternal[], account: string, indices?: readonly number[]): AccountLedger {
  const idx = indices ? [...indices] : lines.flatMap((l, i) => (l.CompteNum === account ? [i] : []));
  idx.sort((a, b) => compareLedgerLines(lines[a]!, lines[b]!) || a - b);
  return running(
    account,
    idx.map((index) => ({ index, line: lines[index]! })),
  );
}

/** Keeps the lines accepted by `keep`; running balance and totals are recomputed on the kept lines. */
export function filterLedger(ledger: AccountLedger, keep: (line: FecLineInternal) => boolean): AccountLedger {
  return running(
    ledger.account,
    ledger.rows.filter((r) => keep(r.line)),
  );
}

/** Value of the auxiliary filter selecting the lines without auxiliary account. */
export const NO_AUX = '(none)';

export interface LedgerFilter {
  /** Journal code; '' for every journal. */
  journal: string;
  /** Auxiliary account; '' for all, NO_AUX for the lines without one. */
  aux: string;
  /** Words to find in the line label or the piece reference (case-, accent- and ligature-insensitive). */
  text: string;
}

export const EMPTY_LEDGER_FILTER: Readonly<LedgerFilter> = { journal: '', aux: '', text: '' };

export function isLedgerFilterActive(f: LedgerFilter): boolean {
  return f.journal !== '' || f.aux !== '' || f.text.trim() !== '';
}

export function ledgerLineMatcher(f: LedgerFilter): (line: FecLineInternal) => boolean {
  const words = fold(f.text).split(/\s+/).filter(Boolean);
  const aux = f.aux === NO_AUX ? '' : f.aux;
  return (l) => {
    if (f.journal && l.JournalCode !== f.journal) return false;
    if (f.aux && l.CompAuxNum !== aux) return false;
    if (words.length) {
      const text = fold(`${l.EcritureLib} ${l.PieceRef}`);
      if (!words.every((w) => text.includes(w))) return false;
    }
    return true;
  };
}

export interface AuxGroup {
  /** Auxiliary account ('' for the lines without one). */
  aux: string;
  label: string;
  count: number;
  debit: Cents;
  credit: Cents;
  /** debit − credit */
  balance: Cents;
}

/** Totals per auxiliary account, in auxiliary order (lines without auxiliary last). */
export function groupByAux(lines: Iterable<FecLineInternal>): AuxGroup[] {
  const m = new Map<string, AuxGroup>();
  for (const l of lines) {
    let g = m.get(l.CompAuxNum);
    if (!g) {
      g = { aux: l.CompAuxNum, label: l.CompAuxLib, count: 0, debit: 0, credit: 0, balance: 0 };
      m.set(l.CompAuxNum, g);
    }
    if (!g.label && l.CompAuxLib) g.label = l.CompAuxLib;
    g.count++;
    g.debit += l.debitCents;
    g.credit += l.creditCents;
    g.balance += l.debitCents - l.creditCents;
  }
  return [...m.values()].sort((a, b) => (a.aux === '' ? 1 : b.aux === '' ? -1 : a.aux < b.aux ? -1 : a.aux > b.aux ? 1 : 0));
}

/** Previous and next accounts of a sorted list (also when `account` is not in it). */
export function neighbours(sorted: readonly string[], account: string): { prev: string | null; next: string | null } {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid]! < account) lo = mid + 1;
    else hi = mid;
  }
  const found = sorted[lo] === account;
  return { prev: lo > 0 ? sorted[lo - 1]! : null, next: sorted[found ? lo + 1 : lo] ?? null };
}

/**
 * Account typed in the picker: 'number – label' (datalist), an exact number,
 * else the first account starting with the digits typed, else the first one
 * whose label starts with the text typed, else the first one whose label
 * contains the words typed.
 */
export function resolveAccount(text: string, accounts: readonly { account: string; label: string }[]): string | null {
  const t = text.trim();
  if (!t) return null;
  const lead = /^(\d+)\s*(?:[–—-]|$)/.exec(t)?.[1];
  if (lead && accounts.some((a) => a.account === lead)) return lead;
  if (/^\d+$/.test(t)) return accounts.find((a) => a.account.startsWith(t))?.account ?? null;
  const matches = accounts.filter((a) => matchesAccount(a.account, a.label, t));
  // A label starting with the text typed wins over one merely containing it.
  const q = fold(t).trim();
  return (matches.find((a) => fold(a.label).startsWith(q)) ?? matches[0])?.account ?? null;
}
