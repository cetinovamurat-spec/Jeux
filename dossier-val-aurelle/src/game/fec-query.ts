/**
 * Journal-entry testing on the FEC (§10.4): combinable filters over FEC lines,
 * computed on an index built once. Pure, no React.
 *
 * Filters on line properties (journal, account, amount…) select lines; entry
 * properties (user, dates, rare account pairs, missing piece) select every line
 * of the qualifying entries. With `wholeEntries`, the result shows every line
 * of an entry as soon as one of its lines matches.
 *
 * Also: standard journal-entry tests (generic presets), input parsing for the
 * filter form, journal summaries and exports (CSV with the internal user).
 */
import { formatDateFr, isWeekend, type IsoDate } from '../engine/dates';
import { toCsv } from '../engine/csv';
import { FEC_FIELDS } from '../engine/fec';
import { formatEuro, formatFecAmount } from '../engine/format';
import type { Cents } from '../engine/money';
import type { FecLineInternal } from '../engine/types';
import { fold } from './text';

export interface FecQuery {
  journals: string[];
  /** Any-of account prefixes (e.g. '4687', '70'). */
  accounts: string[];
  /** Auxiliary account contains (case- and accent-insensitive). */
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

/**
 * Folded text for the searches (case, accents and ligatures ignored, apostrophes
 * as spaces): the same folding as the GED (`fold`, ./text), so that « oeuvre »
 * finds « maîtrise d’œuvre ». Also used by the balance and the command palette.
 */
export const normalize: (text: string) => string = fold;

export interface FecIndex {
  lines: readonly FecLineInternal[];
  closingDate: string;
  /** Entries with more lines than this (and the opening entry) are left out of the pair statistics. */
  maxLinesForPairs: number;
  /** Line indices of each entry (in FEC order). */
  entryLines: ReadonlyMap<string, number[]>;
  /** Normalised searchable text of each line. */
  text: readonly string[];
  /** Normalised auxiliary account (number and label) of each line. */
  auxText: readonly string[];
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

/** Journal of the opening entry (à-nouveaux), never used for pair rarity. */
export const OPENING_JOURNAL = 'AN';
const PAIR_SEPARATOR = '→';

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
    if (first.JournalCode === OPENING_JOURNAL || idx.length > maxLines) continue;
    const debits = new Set<string>();
    const credits = new Set<string>();
    for (const i of idx) {
      const l = lines[i]!;
      if (l.debitCents > 0) debits.add(l.CompteNum);
      if (l.creditCents > 0) credits.add(l.CompteNum);
    }
    const pairs: string[] = [];
    for (const d of debits) for (const c of credits) if (d !== c) pairs.push(`${d}${PAIR_SEPARATOR}${c}`);
    entryPairs.set(id, pairs);
    for (const p of pairs) pairCounts.set(p, (pairCounts.get(p) ?? 0) + 1);
  }
  return {
    lines,
    closingDate: options.closingDate,
    maxLinesForPairs: maxLines,
    entryLines,
    text: lines.map((l) => normalize(`${l.EcritureLib} ${l.PieceRef} ${l.CompteLib} ${l.CompAuxLib}`)),
    auxText: lines.map((l) => normalize(`${l.CompAuxNum} ${l.CompAuxLib}`)),
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

export interface AccountPair {
  pair: string;
  debit: string;
  credit: string;
  /** Number of entries of the year containing this pair. */
  count: number;
}

/** Every debit→credit pair of an entry with its frequency (rarest first); null when the entry is left out of the pair statistics. */
export function pairsOf(index: FecIndex, entryId: string): AccountPair[] | null {
  const pairs = index.entryPairs.get(entryId);
  if (!pairs) return null;
  return pairs
    .map((pair) => {
      const [debit = '', credit = ''] = pair.split(PAIR_SEPARATOR);
      return { pair, debit, credit, count: index.pairCounts.get(pair) ?? 0 };
    })
    .sort((a, b) => a.count - b.count || (a.pair < b.pair ? -1 : a.pair > b.pair ? 1 : 0));
}

/** Lines of an entry, in FEC order (empty when unknown). */
export function entryLinesOf(index: FecIndex, entryId: string): FecLineInternal[] {
  return (index.entryLines.get(entryId) ?? []).map((i) => index.lines[i]!);
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
  const aux = normalize(q.aux).trim();
  const journals = new Set(q.journals);
  const users = new Set(q.users);
  const lineMatches = (i: number): boolean => {
    const l = index.lines[i]!;
    if (journals.size && !journals.has(l.JournalCode)) return false;
    if (prefixes.length && !prefixes.some((p) => l.CompteNum.startsWith(p))) return false;
    if (aux && !index.auxText[i]!.includes(aux)) return false;
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

// ---------------------------------------------------------------------------
// descriptions, comparisons, standard tests
// ---------------------------------------------------------------------------

function euro(cents: Cents): string {
  return formatEuro(cents, cents % 100 === 0 ? 0 : 2);
}

function dateRange(label: string, from: string, to: string): string {
  if (from && to) return `${label} du ${formatDateFr(from)} au ${formatDateFr(to)}`;
  if (from) return `${label} à partir du ${formatDateFr(from)}`;
  return `${label} jusqu’au ${formatDateFr(to)}`;
}

/** Short description of the active filters (chips, saved queries). */
export function describeQuery(q: FecQuery): string[] {
  const parts: string[] = [];
  if (q.journals.length) parts.push(`${q.journals.length > 1 ? 'journaux' : 'journal'} ${q.journals.join(', ')}`);
  if (q.accounts.length) parts.push(`${q.accounts.length > 1 ? 'comptes' : 'compte'} ${q.accounts.join(', ')}`);
  if (q.aux.trim()) parts.push(`auxiliaire « ${q.aux.trim()} »`);
  if (q.users.length) parts.push(`saisies par ${q.users.join(', ')}`);
  if (q.entryFrom || q.entryTo) parts.push(dateRange('datées', q.entryFrom, q.entryTo));
  if (q.validFrom || q.validTo) parts.push(dateRange('validées', q.validFrom, q.validTo));
  if (q.validatedAfterClosing) parts.push('validées après la clôture');
  if (q.weekend !== 'none') parts.push({ entry: 'datées un week-end', validation: 'validées un week-end', either: 'datées ou validées un week-end' }[q.weekend]);
  if (q.roundMultiple) parts.push(`montants ronds (multiples de ${euro(q.roundMultiple)})`);
  if (q.keywords.trim()) parts.push(`mots-clés « ${q.keywords.trim()} »`);
  if (q.minAmount !== null && q.maxAmount !== null) parts.push(`montants de ${euro(q.minAmount)} à ${euro(q.maxAmount)}`);
  else if (q.minAmount !== null) parts.push(`montants ≥ ${euro(q.minAmount)}`);
  else if (q.maxAmount !== null) parts.push(`montants ≤ ${euro(q.maxAmount)}`);
  if (q.rarePairsMax) parts.push(`couples de comptes rares (${q.rarePairsMax} écriture${q.rarePairsMax > 1 ? 's' : ''} au plus)`);
  if (q.missingPiece) parts.push('sans pièce justificative');
  if (q.wholeEntries) parts.push('écritures complètes');
  return parts;
}

/** Canonical form of a query (order of the selected journals, users and prefixes ignored). */
export function queryKey(q: FecQuery): string {
  const full: FecQuery = { ...EMPTY_QUERY, ...q };
  const sorted = (a: readonly string[]) => [...a].sort();
  return JSON.stringify({ ...full, journals: sorted(full.journals), users: sorted(full.users), accounts: sorted(full.accounts), aux: full.aux.trim(), keywords: full.keywords.trim() });
}

export function sameQuery(a: FecQuery, b: FecQuery): boolean {
  return queryKey(a) === queryKey(b);
}

export function isEmptyQuery(q: FecQuery): boolean {
  return sameQuery(q, EMPTY_QUERY);
}

export interface StandardTestContext {
  closingDate: IsoDate;
  /** Multiple used by the round-amount test (cents). */
  roundMultiple: Cents;
  rarePairsMax: number;
  /** Journals of miscellaneous operations (OD). */
  miscJournals: readonly string[];
  /** Users who enter entries by hand (interfaces and technical users excluded). */
  manualUsers: readonly string[];
}

export interface StandardTest {
  id: 'afterClosing' | 'weekend' | 'roundAmounts' | 'rarePairs' | 'missingPiece' | 'manualMisc';
  /** Short label of the button. */
  label: string;
  description: string;
  query: FecQuery;
}

/** Usual journal-entry tests (generic: the same for any FEC). Each one sets the whole query. */
export function standardTests(ctx: StandardTestContext): StandardTest[] {
  const n = ctx.rarePairsMax;
  return [
    {
      id: 'afterClosing',
      label: 'Validées après la clôture',
      description: `Écritures validées après le ${formatDateFr(ctx.closingDate)} : écritures d’inventaire et écritures tardives, à examiner au regard du risque de contournement des contrôles.`,
      query: { ...EMPTY_QUERY, validatedAfterClosing: true },
    },
    {
      id: 'weekend',
      label: 'Datées ou validées un week-end',
      description: 'Écritures dont la date comptable ou la date de validation tombe un samedi ou un dimanche.',
      query: { ...EMPTY_QUERY, weekend: 'either' },
    },
    {
      id: 'roundAmounts',
      label: 'Montants ronds',
      description: `Lignes dont le montant est un multiple de ${euro(ctx.roundMultiple)}.`,
      query: { ...EMPTY_QUERY, roundMultiple: ctx.roundMultiple },
    },
    {
      id: 'rarePairs',
      label: 'Couples de comptes rares',
      description: `Écritures associant un compte débité et un compte crédité rencontrés ensemble dans ${n} écriture${n > 1 ? 's' : ''} au plus sur l’exercice (hors à-nouveaux et écritures récapitulatives).`,
      query: { ...EMPTY_QUERY, rarePairsMax: n },
    },
    {
      id: 'missingPiece',
      label: 'Sans pièce',
      description: 'Écritures sans référence de pièce justificative.',
      query: { ...EMPTY_QUERY, missingPiece: true },
    },
    {
      id: 'manualMisc',
      label: 'OD manuelles',
      description: `Écritures manuelles d’opérations diverses (journal ${ctx.miscJournals.join(', ')}) : saisies par un utilisateur, hors interfaces et reprise de données.`,
      query: { ...EMPTY_QUERY, journals: [...ctx.miscJournals], users: [...ctx.manualUsers] },
    },
  ];
}

// ---------------------------------------------------------------------------
// filter form inputs
// ---------------------------------------------------------------------------

/** Account prefixes typed in one field, separated by spaces, commas or semicolons. */
export function parseAccountPrefixes(text: string): string[] {
  return text
    .split(/[\s,;]+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Amount typed in euros ('12 500,50', '12500.5'): cents with Math.round(value × 100);
 * empty → null (no bound); anything else is invalid.
 */
export function parseEuroAmount(text: string): { cents: Cents | null; valid: boolean } {
  // \s covers the no-break and narrow no-break spaces of fr-FR digit grouping.
  const t = text.replace(/\s/g, '').replace(',', '.');
  if (!t) return { cents: null, valid: true };
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(t)) return { cents: null, valid: false };
  return { cents: Math.round(Number(t) * 100), valid: true };
}

/** Text of an amount field for a stored bound (inverse of parseEuroAmount). */
export function euroInputText(cents: Cents | null): string {
  if (cents === null) return '';
  return cents % 100 === 0 ? String(cents / 100) : formatFecAmount(cents);
}

// ---------------------------------------------------------------------------
// summaries and exports
// ---------------------------------------------------------------------------

export interface JournalSummaryRow {
  journal: string;
  label: string;
  entries: number;
  lines: number;
  debit: Cents;
  credit: Cents;
}

/** Entries and lines per journal, over the whole FEC or over a selection of line indices. */
export function journalSummary(index: FecIndex, lineIndices?: readonly number[]): JournalSummaryRow[] {
  const rows = new Map<string, JournalSummaryRow & { ids: Set<string> }>();
  const visit = (i: number) => {
    const l = index.lines[i]!;
    let r = rows.get(l.JournalCode);
    if (!r) {
      r = { journal: l.JournalCode, label: l.JournalLib, entries: 0, lines: 0, debit: 0, credit: 0, ids: new Set() };
      rows.set(l.JournalCode, r);
    }
    r.lines++;
    r.debit += l.debitCents;
    r.credit += l.creditCents;
    r.ids.add(l.entryId);
  };
  if (lineIndices) for (const i of lineIndices) visit(i);
  else for (let i = 0; i < index.lines.length; i++) visit(i);
  return [...rows.values()].sort((a, b) => (a.journal < b.journal ? -1 : a.journal > b.journal ? 1 : 0)).map(({ ids, ...r }) => ({ ...r, entries: ids.size }));
}

/** Header of the internal user column in the CSV export (not a FEC field). */
export const CSV_USER_FIELD = 'SaisiPar';

/** CSV export (semicolon, BOM for spreadsheet software): the 18 FEC fields plus the internal user. */
export function fecToCsv(lines: readonly FecLineInternal[]): string {
  return `﻿${toCsv([[...FEC_FIELDS, CSV_USER_FIELD], ...lines.map((l) => [...FEC_FIELDS.map((f) => l[f]), l.enteredBy])])}`;
}
