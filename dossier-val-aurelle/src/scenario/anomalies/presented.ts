/**
 * Presented world and correction key.
 *
 * state(S) = clean world + patches of the active parts S, applied in canonical
 * order. The presented world is state(all parts); the corrected (clean) world is
 * state(∅). The correction entry of a part is the account-by-account difference
 * between the state where it is corrected and the state where it is not, the
 * previous parts (canonical order) being already corrected. Hence, by
 * construction: presented + Σ corrections = clean. Impacts are read on these
 * differences (result, equity, CAF, net self-financing, balance sheet), never
 * declared.
 */
import { keyFigures, type KeyFigures } from '../../engine/analysis';
import { closingBalances, closingBalancesByAux } from '../../engine/balance';
import type { Cents } from '../../engine/money';
import { buildStatements } from '../../engine/statements';
import type { EntryLine, FinancialStatements, JournalEntry, Ledger, World } from '../../engine/types';
import type { ScenarioDatasets } from '../datasets';
import type { Params } from '../params';
import { WorldDraft, type PresentationFacts } from './draft';
import { ANOMALIES, PART_KEYS, moduleOf } from './modules';
import type { AnomalyContext, AnomalyId, AnomalyPart, PartKey } from './types';

export interface AnomalyState {
  active: ReadonlySet<PartKey>;
  world: World;
  facts: PresentationFacts;
  /** Entry id → anomalies that patched it. */
  touched: ReadonlyMap<string, AnomalyId[]>;
}

/** World where the parts of `active` are not corrected (the others are). */
export function buildState(clean: World, params: Params, active: Iterable<PartKey>): AnomalyState {
  const set = new Set(active);
  for (const k of set) if (!PART_KEYS.includes(k)) throw new Error(`partie d’anomalie inconnue : ${k}`);
  const draft = new WorldDraft(clean);
  const ctx: AnomalyContext = { params, clean, data: clean.datasets as unknown as ScenarioDatasets, isActive: (k) => set.has(k) };
  for (const m of ANOMALIES) {
    if (!m.parts.some((p) => set.has(p.id))) continue;
    draft.setCurrent(m.id);
    m.apply(draft, ctx);
  }
  draft.finalise(params);
  return { active: set, world: draft.toWorld(), facts: draft.facts, touched: draft.touched };
}

export interface StateFigures {
  balances: Map<string, Cents>;
  figures: KeyFigures;
  statements: FinancialStatements;
}

/** Repayments of rental-activity loans due in the year (early repayments excluded). */
export function loanRepayments(world: World, year: number): Cents {
  const ds = world.datasets as unknown as ScenarioDatasets;
  const rental = new Set(ds.loans.filter((l) => l.activity === 'rental').map((l) => l.id));
  let s = 0;
  for (const l of ds.loanSchedules) if (rental.has(l.loanId) && !l.early && l.dueDate.startsWith(`${year}-`)) s += l.principal;
  return s;
}

export function stateFigures(world: World, params: Params): StateFigures {
  const balances = closingBalances(world.ledgers.current);
  const statements = buildStatements({
    defs: params.statements,
    chart: world.chart,
    current: balances,
    prior: closingBalances(world.ledgers.prior),
    currentYear: world.meta.currentYear,
    priorYear: world.meta.priorYear,
    presentation: world.presentation,
  });
  return { balances, figures: keyFigures(balances, params.analysis, loanRepayments(world, world.meta.currentYear)), statements };
}

/** Effect of a correction, as overstatement of the presented figure (before − after). */
export interface Impact {
  result: Cents;
  equity: Cents;
  caf: Cents;
  netSelfFinancing: Cents;
  totalAssets: Cents;
  /** Statement lines (current year) changed by the correction. */
  lines: Record<string, Cents>;
}

export interface Correction {
  key: PartKey;
  anomalyId: AnomalyId;
  part: AnomalyPart;
  /** Null when the part has no accounting effect (annex, report, governance, presentation). */
  entry: JournalEntry | null;
  impact: Impact;
  /** Net self-financing ratio and result after this correction (cumulative). */
  after: { netResult: Cents; netSelfFinancingRatio: number };
}

export interface CorrectionKey {
  presented: AnomalyState;
  presentedFigures: StateFigures;
  cleanFigures: StateFigures;
  corrections: Correction[];
}

function diffEntry(before: Ledger, after: Ledger, key: PartKey, label: string): JournalEntry | null {
  const b = closingBalancesByAux(before);
  const a = closingBalancesByAux(after);
  const lines: EntryLine[] = [];
  for (const k of [...new Set([...b.keys(), ...a.keys()])].sort()) {
    const delta = (a.get(k) ?? 0) - (b.get(k) ?? 0);
    if (delta === 0) continue;
    const [account, aux] = k.split('|') as [string, string];
    const base = aux ? { aux } : {};
    lines.push(delta > 0 ? { account, debit: delta, credit: 0, ...base } : { account, debit: 0, credit: -delta, ...base });
  }
  if (lines.length === 0) return null;
  return {
    id: `2025:COR:${key}`,
    journal: 'OD',
    date: '2025-12-31',
    label: `Correction ${key} – ${label}`.slice(0, 160),
    lines,
    validDate: '2025-12-31',
    enteredBy: 'AUDIT',
    origin: `correction:${key}`,
  };
}

function impactBetween(before: StateFigures, after: StateFigures): Impact {
  const lines: Record<string, Cents> = {};
  for (const [id, v] of Object.entries(before.statements.lines)) {
    const d = v.current - (after.statements.lines[id]?.current ?? 0);
    if (d !== 0) lines[id] = d;
  }
  return {
    result: before.figures.netResult - after.figures.netResult,
    equity: (before.statements.lines['P_CP']?.current ?? 0) - (after.statements.lines['P_CP']?.current ?? 0),
    caf: before.figures.caf - after.figures.caf,
    netSelfFinancing: before.figures.netSelfFinancing - after.figures.netSelfFinancing,
    totalAssets: before.statements.checks.assetsTotal - after.statements.checks.assetsTotal,
    lines,
  };
}

/** Line of a correction entry proposed by the player (account of the chart, cents). */
export interface ProposedEntryLine {
  account: string;
  debit: Cents;
  credit: Cents;
}

const priorBalancesCache = new WeakMap<World, Map<string, Cents>>();

/**
 * Figures of the presented accounts once the lines are applied (balances,
 * statements and key figures rebuilt with the code of the key). Lines on an
 * account absent from the chart are ignored (the findings form only offers
 * the accounts of the chart). The repayments of the year are those of the
 * presented accounts: a correction entry does not change the loan schedules.
 */
export function figuresWithLines(presented: StateFigures, lines: readonly ProposedEntryLine[], ctx: { world: World; params: Params }): StateFigures {
  const known = new Set(ctx.world.chart.accounts.map((a) => a.number));
  const balances = new Map(presented.balances);
  for (const l of lines) {
    if (!known.has(l.account)) continue;
    balances.set(l.account, (balances.get(l.account) ?? 0) + l.debit - l.credit);
  }
  let prior = priorBalancesCache.get(ctx.world);
  if (!prior) {
    prior = closingBalances(ctx.world.ledgers.prior);
    priorBalancesCache.set(ctx.world, prior);
  }
  const statements = buildStatements({
    defs: ctx.params.statements,
    chart: ctx.world.chart,
    current: balances,
    prior,
    currentYear: ctx.world.meta.currentYear,
    priorYear: ctx.world.meta.priorYear,
    presentation: ctx.world.presentation,
  });
  return { balances, figures: keyFigures(balances, ctx.params.analysis, presented.figures.loanRepayments), statements };
}

/**
 * Impact of a correction entry proposed by the player, as overstatement of
 * the presented figures (before − after), read exactly like the impacts of
 * the key (impactBetween): result, equity, CAF, net self-financing, balance
 * sheet total and statement lines. Several entries are applied at once by
 * passing all their lines (the net self-financing ratio is not additive).
 */
export function impactOfLines(presented: StateFigures, lines: readonly ProposedEntryLine[], ctx: { world: World; params: Params }): Impact {
  return impactBetween(presented, figuresWithLines(presented, lines, ctx));
}

/** Presented world and correction entries of every part, in canonical order. */
export function buildCorrectionKey(clean: World, params: Params, keys: readonly PartKey[] = PART_KEYS): CorrectionKey {
  const active = new Set(keys);
  const presented = buildState(clean, params, active);
  const presentedFigures = stateFigures(presented.world, params);
  let prev = presented;
  let prevFigures = presentedFigures;
  const corrections: Correction[] = [];
  for (const key of keys) {
    active.delete(key);
    const next = buildState(clean, params, active);
    const nextFigures = stateFigures(next.world, params);
    const m = moduleOf(key);
    const part = m.parts.find((p) => p.id === key)!;
    corrections.push({
      key,
      anomalyId: m.id,
      part,
      entry: diffEntry(prev.world.ledgers.current, next.world.ledgers.current, key, part.label),
      impact: impactBetween(prevFigures, nextFigures),
      after: { netResult: nextFigures.figures.netResult, netSelfFinancingRatio: nextFigures.figures.netSelfFinancingRatio },
    });
    prev = next;
    prevFigures = nextFigures;
  }
  return { presented, presentedFigures, cleanFigures: prevFigures, corrections };
}

/** Impact of a whole anomaly (sum of its parts). */
export function anomalyImpact(key: CorrectionKey, id: AnomalyId): Impact {
  const parts = key.corrections.filter((c) => c.anomalyId === id);
  const sum: Impact = { result: 0, equity: 0, caf: 0, netSelfFinancing: 0, totalAssets: 0, lines: {} };
  for (const c of parts) {
    sum.result += c.impact.result;
    sum.equity += c.impact.equity;
    sum.caf += c.impact.caf;
    sum.netSelfFinancing += c.impact.netSelfFinancing;
    sum.totalAssets += c.impact.totalAssets;
    for (const [k, v] of Object.entries(c.impact.lines)) sum.lines[k] = (sum.lines[k] ?? 0) + v;
  }
  return sum;
}
