/**
 * Ticking (pointage) of the financial statements, the annex and the certified
 * prior-year accounts: cell keys, display order of the statement lines,
 * progress counts, mark usage, and the composition of a statement line or an
 * annex row from the trial balance. Pure helpers: no React, no UI.
 *
 * Nothing here compares figures or flags differences: finding them is the
 * player's job.
 */
import { isContraAsset, isIncomeStatementAccount } from '../engine/chart';
import type { Cents } from '../engine/money';
import { statementLineFor } from '../engine/statements';
import type { PresentationOverrides, StatementId, StatementLineDef } from '../engine/types';
import { setTick, type GameState, type TickMark } from './state';

// ---------------------------------------------------------------------------
// cell keys
// ---------------------------------------------------------------------------

/** Figure columns of the statements: gross, depreciation, net (current year) and comparative. */
export type StatementColumn = 'brut' | 'amort' | 'n' | 'n-1';

export const STATEMENT_PREFIX = 'etats:';
export const ANNEX_PREFIX = 'annexe:';
export const CERTIFIED_PREFIX = 'certifies:';

/** 'etats:<lineId>:<col>' */
export function statementCell(lineId: string, column: StatementColumn): string {
  return `${STATEMENT_PREFIX}${lineId}:${column}`;
}

/** 'annexe:<tableId>:<rowId>:<colId>' */
export function annexCell(tableId: string, rowId: string, columnId: string): string {
  return `${ANNEX_PREFIX}${tableId}:${rowId}:${columnId}`;
}

/** 'certifies:<lineId>' */
export function certifiedCell(lineId: string): string {
  return `${CERTIFIED_PREFIX}${lineId}`;
}

/** Columns shown for a statement: gross / depreciation / net / comparative for the assets, current / comparative otherwise. */
export function statementColumns(statement: StatementId): readonly StatementColumn[] {
  return statement === 'assets' ? ['brut', 'amort', 'n', 'n-1'] : ['n', 'n-1'];
}

// ---------------------------------------------------------------------------
// display order
// ---------------------------------------------------------------------------

export interface OrderedLine {
  def: StatementLineDef;
  /** Number of ancestors (indentation level). */
  depth: number;
}

export const STATEMENT_ORDER: readonly StatementId[] = ['assets', 'liabilities', 'income'];

/**
 * Lines of a statement in display order: definition order (each subtotal
 * heads its children), with the balance-sheet totals moved to the bottom
 * (the definitions list them first).
 */
export function orderedLines(defs: readonly StatementLineDef[], statement: StatementId): OrderedLine[] {
  const byId = new Map(defs.map((d) => [d.id, d]));
  const depth = (d: StatementLineDef): number => {
    let n = 0;
    const seen = new Set<string>();
    for (let p = d.parent; p && !seen.has(p); p = byId.get(p)?.parent) {
      seen.add(p);
      n++;
    }
    return n;
  };
  const lines = defs.filter((d) => d.statement === statement);
  const ordered = statement === 'income' ? lines : [...lines.filter((d) => d.kind !== 'total'), ...lines.filter((d) => d.kind === 'total')];
  return ordered.map((def) => ({ def, depth: depth(def) }));
}

/** Lines making up a subtotal (its children) or a total with a formula (its signed terms). */
export function componentLines(defs: readonly StatementLineDef[], id: string): { def: StatementLineDef; sign: 1 | -1 }[] {
  const byId = new Map(defs.map((d) => [d.id, d]));
  const def = byId.get(id);
  if (!def || def.kind === 'detail') return [];
  if (def.formula) {
    return def.formula.flatMap((term) => {
      const d = byId.get(term.slice(1));
      return d ? [{ def: d, sign: term.startsWith('-') ? (-1 as const) : (1 as const) }] : [];
    });
  }
  return defs.filter((d) => d.parent === id).map((d) => ({ def: d, sign: 1 as const }));
}

// ---------------------------------------------------------------------------
// tickable cells
// ---------------------------------------------------------------------------

/** Every tickable cell of a statement tab, in display order (row by row). */
export function statementCells(defs: readonly StatementLineDef[], statement: StatementId): string[] {
  const cols = statementColumns(statement);
  return orderedLines(defs, statement).flatMap(({ def }) => cols.map((c) => statementCell(def.id, c)));
}

/** Every tickable cell of the certified prior-year accounts (assets, liabilities, income). */
export function certifiedCells(defs: readonly StatementLineDef[]): string[] {
  return STATEMENT_ORDER.flatMap((s) => orderedLines(defs, s).map(({ def }) => certifiedCell(def.id)));
}

/** Structural view of an annex table (scenario/annex AnnexTable). */
export interface AnnexTableShape {
  id: string;
  columns: readonly { id: string }[];
  rows: readonly { id: string }[];
}

/** Every tickable value cell of the annex tables (row by row). */
export function annexCells(tables: readonly AnnexTableShape[]): string[] {
  return tables.flatMap((t) => t.rows.flatMap((r) => t.columns.map((c) => annexCell(t.id, r.id, c.id))));
}

// ---------------------------------------------------------------------------
// progress and counts
// ---------------------------------------------------------------------------

export type Ticks = Readonly<Record<string, string>>;

export interface TickProgress {
  /** Tickable cells. */
  total: number;
  /** Cells carrying a mark. */
  ticked: number;
  /** Ticked cells per mark id. */
  byMark: Record<string, number>;
}

/** Progress over a list of cells (ticks on other cells are ignored). */
export function tickProgress(ticks: Ticks, cells: readonly string[]): TickProgress {
  const byMark: Record<string, number> = {};
  let ticked = 0;
  for (const cell of new Set(cells)) {
    const m = ticks[cell];
    if (m === undefined) continue;
    ticked++;
    byMark[m] = (byMark[m] ?? 0) + 1;
  }
  return { total: new Set(cells).size, ticked, byMark };
}

/** Number of ticked cells whose key starts with a prefix ('etats:', 'annexe:', 'certifies:'…). */
export function countByPrefix(ticks: Ticks, prefix: string): number {
  let n = 0;
  for (const cell of Object.keys(ticks)) if (cell.startsWith(prefix)) n++;
  return n;
}

/** Uses of each mark over all the ticks (every listed mark appears, unused ones with 0). */
export function markUsage(ticks: Ticks, marks: readonly TickMark[] = []): Record<string, number> {
  const usage: Record<string, number> = {};
  for (const m of marks) usage[m.id] = 0;
  for (const m of Object.values(ticks)) usage[m] = (usage[m] ?? 0) + 1;
  return usage;
}

/** Ratio ticked / total in [0, 1] (0 when there is nothing to tick). */
export function progressRatio(p: TickProgress): number {
  return p.total === 0 ? 0 : p.ticked / p.total;
}

/** Removes the ticks of the given cells (e.g. clearing a whole tab). */
export function clearTicks(s: GameState, cells: readonly string[]): GameState {
  let next = s;
  for (const cell of cells) if (next.ticks[cell] !== undefined) next = setTick(next, cell, null);
  return next;
}

/** Mark selected by a digit key: '1' → first mark … '9' → ninth mark. */
export function markForDigit(marks: readonly TickMark[], key: string): TickMark | undefined {
  if (!/^[1-9]$/.test(key)) return undefined;
  return marks[Number(key) - 1];
}

/** Number of characters as the player sees them (a symbol is limited to 2). */
export function symbolLength(symbol: string): number {
  return Array.from(symbol.trim()).length;
}

export const MAX_SYMBOL_LENGTH = 2;

// ---------------------------------------------------------------------------
// composition of a statement line (passage balance → états)
// ---------------------------------------------------------------------------

export type ChartLookup = ReadonlyMap<string, { rubriqueDebit: string; rubriqueCredit: string }>;

export interface CompositionItem {
  account: string;
  /** Closing balance, debit positive. */
  balance: Cents;
  /** Amount in the sign convention of the statement (see lineComposition). */
  amount: Cents;
  /** Assets: gross value or depreciation column; other statements: 'value'. */
  part: 'gross' | 'depreciation' | 'value';
  /** A presentation reclassification sends the account to this line (designer diagnostics only). */
  reclassified: boolean;
}

export interface LineComposition {
  items: CompositionItem[];
  /** Assets only: sum of the gross values and of the depreciation (positive). */
  gross: Cents;
  depreciation: Cents;
  /** Net amount of the line (assets: gross − depreciation). */
  total: Cents;
}

/**
 * Accounts with a non-zero balance mapped to a detail line for a year, with
 * the sign convention of the statements: assets debit positive (contra-asset
 * accounts 28, 29, 39, 49, 59 in the depreciation column, positive), liabilities
 * and products credit positive, charges debit positive. The total is the
 * figure the statement engine computes for the line.
 */
export function lineComposition(def: StatementLineDef, balances: ReadonlyMap<string, Cents>, chart: ChartLookup, presentation: PresentationOverrides, year: number): LineComposition {
  const items: CompositionItem[] = [];
  let gross = 0;
  let depreciation = 0;
  let value = 0;
  for (const [account, balance] of balances) {
    if (balance === 0 || !chart.has(account)) continue;
    if (statementLineFor(account, balance, chart, presentation, year) !== def.id) continue;
    const reclassified = presentation.reclassifications.some((r) => r.account === account && r.years.includes(year));
    if (isIncomeStatementAccount(account)) {
      const amount = def.nature === 'charge' ? balance : -balance;
      value += amount;
      items.push({ account, balance, amount, part: 'value', reclassified });
    } else if (def.statement === 'assets') {
      if (isContraAsset(account)) {
        depreciation += -balance;
        items.push({ account, balance, amount: -balance, part: 'depreciation', reclassified });
      } else {
        gross += balance;
        items.push({ account, balance, amount: balance, part: 'gross', reclassified });
      }
    } else {
      value += -balance;
      items.push({ account, balance, amount: -balance, part: 'value', reclassified });
    }
  }
  const rank = { gross: 0, depreciation: 1, value: 2 } as const;
  items.sort((a, b) => rank[a.part] - rank[b.part] || a.account.localeCompare(b.account));
  return { items, gross, depreciation, total: value + gross - depreciation };
}

export interface ResultComposition {
  /** Class 7 balances, credit positive. */
  products: Cents;
  /** Class 6 balances, debit positive. */
  charges: Cents;
  /** products − charges. */
  result: Cents;
}

/** Net result of the year from the income-statement accounts (line flagged isResult). */
export function resultComposition(balances: ReadonlyMap<string, Cents>): ResultComposition {
  let products = 0;
  let charges = 0;
  for (const [account, b] of balances) {
    if (account.startsWith('7')) products -= b;
    else if (account.startsWith('6')) charges += b;
  }
  return { products, charges, result: products - charges };
}

// ---------------------------------------------------------------------------
// accounts behind an annex row
// ---------------------------------------------------------------------------

export interface PrefixAccount {
  account: string;
  /** Opening balance (closing balance of the previous year), debit positive. */
  opening: Cents;
  /** Closing balance, debit positive. */
  closing: Cents;
}

/**
 * Accounts starting with one of the prefixes, with their opening and closing
 * balances (accounts with both balances at zero are left out), sorted, and the
 * sums of each column.
 */
export function accountsByPrefixes(
  prefixes: readonly string[],
  opening: ReadonlyMap<string, Cents>,
  closing: ReadonlyMap<string, Cents>,
): { accounts: PrefixAccount[]; opening: Cents; closing: Cents } {
  if (prefixes.length === 0) return { accounts: [], opening: 0, closing: 0 };
  const match = (a: string) => prefixes.some((p) => a.startsWith(p));
  const all = [...new Set([...opening.keys(), ...closing.keys()])].filter(match).sort();
  const accounts: PrefixAccount[] = [];
  let o = 0;
  let c = 0;
  for (const account of all) {
    const ob = opening.get(account) ?? 0;
    const cb = closing.get(account) ?? 0;
    if (ob === 0 && cb === 0) continue;
    accounts.push({ account, opening: ob, closing: cb });
    o += ob;
    c += cb;
  }
  return { accounts, opening: o, closing: c };
}
