/**
 * Journal-entry testing on the FEC (§10.4): combinable filters over FEC lines,
 * computed on an index built once. Pure, no React.
 *
 * Filters on line properties (journal, account, amount…) select lines; entry
 * properties (user, dates, rare account pairs, missing piece) select every line
 * of the qualifying entries. With `wholeEntries`, the result shows every line
 * of an entry as soon as one of its lines matches.
 */
import { isWeekend } from '../engine/dates';
import type { Cents } from '../engine/money';
import type { FecLineInternal } from '../engine/types';

export interface FecQuery {
  journals: string[];
  /** Any-of account prefixes (e.g. '4687', '70'). */
  accounts: string[];
  /** Auxiliary account contains (case-insensitive). */
  aux: string;
  users: string[];
  entryFrom: string;
  entryTo: string;
  validFrom: string;
  validTo: string;
  /** Validated after the closing date of the year. */
  validatedAfterClosing: boolean;
  weekend: 'none' | 'entry' | 'validation' | 'either';
  /** Line amount is a multiple of this amount in cents (0 = off). */
  roundMultiple: Cents;
  /** All words must appear in the label, piece reference or account label. */
  keywords: string;
  minAmount: Cents | null;
  maxAmount: Cents | null;
  /** Entries containing a debit/credit account pair seen in at most N entries of the year (0 = off). */
  rarePairsMax: number;
  missingPiece: boolean;
  wholeEntries: boolean;
}

export const EMPTY_QUERY: FecQuery = {
  journals: [],
  accounts: [],
  aux: '',
  users: [],
  entryFrom: '',
  entryTo: '',
  validFrom: '',
  validTo: '',
  validatedAfterClosing: false,
  weekend: 'none',
  roundMultiple: 0,
  keywords: '',
  minAmount: null,
  maxAmount: null,
  rarePairsMax: 0,
  missingPiece: false,
  wholeEntries: false,
};

export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, ' ')
    .toLowerCase();
}

export interface FecIndex {
  lines: readonly FecLineInternal[];
  closingDate: string;
  /** Line indices of each entry (in FEC order). */
  entryLines: ReadonlyMap<string, number[]>;
  /** Normalised searchable text of each line. */
  text: readonly string[];
  /** Number of entries in which each 'debit→credit' pair appears (opening entry and entries of more than `maxLinesForPairs` lines excluded). */
  pairCounts: ReadonlyMap<string, number>;
  /** Pairs of each entry. */
  entryPairs: ReadonlyMap<string, string[]>;
  users: readonly string[];
  journals: readonly string[];
}

export interface IndexOptions {
  closingDate: string;
  /** Large summary entries (interfaces, opening) are not used for pair rarity. */
  maxLinesForPairs?: number;
}

export function buildFecIndex(lines: readonly FecLineInternal[], options: IndexOptions): FecIndex {
  const maxLines = options.maxLinesForPairs ?? 20;
  const entryLines = new Map<string, number[]>();
  lines.forEach((l, i) => {
    const list = entryLines.get(l.entryId);
    if (list) list.push(i);
    else entryLines.set(l.entryId, [i]);
  });
  const entryPairs = new Map<string, string[]>();
  const pairCounts = new Map<string, number>();
  for (const [id, idx] of entryLines) {
    const first = lines[idx[0]!]!;
    if (first.JournalCode === 'AN' || idx.length > maxLines) continue;
    const debits = new Set<string>();
    const credits = new Set<string>();
    for (const i of idx) {
      const l = lines[i]!;
      if (l.debitCents > 0) debits.add(l.CompteNum);
      if (l.creditCents > 0) credits.add(l.CompteNum);
    }
    const pairs: string[] = [];
    for (const d of debits) for (const c of credits) if (d !== c) pairs.push(`${d}→${c}`);
    entryPairs.set(id, pairs);
    for (const p of pairs) pairCounts.set(p, (pairCounts.get(p) ?? 0) + 1);
  }
  return {
    lines,
    closingDate: options.closingDate,
    entryLines,
    text: lines.map((l) => normalize(`${l.EcritureLib} ${l.PieceRef} ${l.CompteLib} ${l.CompAuxLib}`)),
    pairCounts,
    entryPairs,
    users: [...new Set(lines.map((l) => l.enteredBy))].sort(),
    journals: [...new Set(lines.map((l) => l.JournalCode))].sort(),
  };
}

/** Rare pairs of an entry with their number of occurrences in the year. */
export function rarePairsOf(index: FecIndex, entryId: string, max: number): { pair: string; count: number }[] {
  return (index.entryPairs.get(entryId) ?? []).map((pair) => ({ pair, count: index.pairCounts.get(pair) ?? 0 })).filter((x) => x.count <= max);
}

export interface QueryResult {
  /** Line indices, in FEC order. */
  lines: number[];
  entries: number;
  debit: Cents;
  credit: Cents;
}

export function runQuery(index: FecIndex, q: FecQuery): QueryResult {
  const words = normalize(q.keywords).split(/[^a-z0-9]+/).filter(Boolean);
  const prefixes = q.accounts.map((a) => a.trim()).filter(Boolean);
  const aux = q.aux.trim().toLowerCase();
  const journals = new Set(q.journals);
  const users = new Set(q.users);
  const lineMatches = (i: number): boolean => {
    const l = index.lines[i]!;
    if (journals.size && !journals.has(l.JournalCode)) return false;
    if (prefixes.length && !prefixes.some((p) => l.CompteNum.startsWith(p))) return false;
    if (aux && !`${l.CompAuxNum} ${l.CompAuxLib}`.toLowerCase().includes(aux)) return false;
    const amount = l.debitCents || l.creditCents;
    if (q.roundMultiple > 0 && (amount === 0 || amount % q.roundMultiple !== 0)) return false;
    if (q.minAmount !== null && amount < q.minAmount) return false;
    if (q.maxAmount !== null && amount > q.maxAmount) return false;
    if (words.length && !words.every((w) => index.text[i]!.includes(w))) return false;
    return true;
  };
  const entryMatches = (idx: readonly number[]): boolean => {
    const l = index.lines[idx[0]!]!;
    if (users.size && !users.has(l.enteredBy)) return false;
    if (q.entryFrom && l.date < q.entryFrom) return false;
    if (q.entryTo && l.date > q.entryTo) return false;
    if (q.validFrom && l.validDate < q.validFrom) return false;
    if (q.validTo && l.validDate > q.validTo) return false;
    if (q.validatedAfterClosing && l.validDate <= index.closingDate) return false;
    if (q.weekend === 'entry' && !isWeekend(l.date)) return false;
    if (q.weekend === 'validation' && !isWeekend(l.validDate)) return false;
    if (q.weekend === 'either' && !isWeekend(l.date) && !isWeekend(l.validDate)) return false;
    if (q.missingPiece && l.PieceRef !== '') return false;
    if (q.rarePairsMax > 0 && rarePairsOf(index, l.entryId, q.rarePairsMax).length === 0) return false;
    return true;
  };
  const out: number[] = [];
  const entries = new Set<string>();
  for (const [id, idx] of index.entryLines) {
    if (!entryMatches(idx)) continue;
    const hits = idx.filter(lineMatches);
    if (!hits.length) continue;
    entries.add(id);
    out.push(...(q.wholeEntries ? idx : hits));
  }
  out.sort((a, b) => a - b);
  let debit = 0;
  let credit = 0;
  for (const i of out) {
    debit += index.lines[i]!.debitCents;
    credit += index.lines[i]!.creditCents;
  }
  return { lines: out, entries: entries.size, debit, credit };
}

/** Short description of the active filters (saved queries, export headers). */
export function describeQuery(q: FecQuery): string[] {
  const parts: string[] = [];
  if (q.journals.length) parts.push(`journaux ${q.journals.join(', ')}`);
  if (q.accounts.length) parts.push(`comptes ${q.accounts.join(', ')}`);
  if (q.aux) parts.push(`auxiliaire « ${q.aux} »`);
  if (q.users.length) parts.push(`utilisateurs ${q.users.join(', ')}`);
  if (q.entryFrom || q.entryTo) parts.push(`date d’écriture ${q.entryFrom || '…'} → ${q.entryTo || '…'}`);
  if (q.validFrom || q.validTo) parts.push(`date de validation ${q.validFrom || '…'} → ${q.validTo || '…'}`);
  if (q.validatedAfterClosing) parts.push('validées après la clôture');
  if (q.weekend !== 'none') parts.push({ entry: 'datées un week-end', validation: 'validées un week-end', either: 'datées ou validées un week-end' }[q.weekend]);
  if (q.roundMultiple) parts.push('montants ronds');
  if (q.keywords.trim()) parts.push(`mots-clés « ${q.keywords.trim()} »`);
  if (q.minAmount !== null || q.maxAmount !== null) parts.push('fourchette de montants');
  if (q.rarePairsMax) parts.push(`couples de comptes vus dans ${q.rarePairsMax} écriture(s) au plus`);
  if (q.missingPiece) parts.push('sans pièce justificative');
  if (q.wholeEntries) parts.push('écritures complètes');
  return parts;
}
