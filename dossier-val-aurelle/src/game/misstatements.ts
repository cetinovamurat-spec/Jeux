/**
 * Table of misstatements (plan J4 §13.3; cahier des charges §10.6): built
 * from the findings with the status « constat ». Every impact is derived from
 * the proposed entries with the code of the key (impactOfLines): never typed.
 *
 * - one row per finding: result, equity, CAF and net self-financing impacts
 *   (overstatement of the presented figure positive), direction, below the
 *   clearly trivial threshold (listed, not cumulated), individually
 *   significant (flagged);
 * - totals: overstatements and understatements separated, net, compared with
 *   the player's three thresholds (materiality in force; none: said so);
 * - all the entries applied at once (the net self-financing ratio is not
 *   additive): corrected result, equity, CAF, net self-financing and ratio of
 *   the year, and three-year mean, against the regulatory reference rates;
 * - `correctionStatus` stays empty (negotiation, J6).
 *
 * Reads the presented world only (never the correction key). Pure.
 */
import { keyFigures } from '../engine/analysis';
import { closingBalances } from '../engine/balance';
import type { Cents } from '../engine/money';
import type { World } from '../engine/types';
import { figuresWithLines, impactOfLines, loanRepayments, stateFigures, type Impact, type StateFigures } from '../scenario/anomalies/presented';
import type { Params } from '../scenario/params';
import { findingAmount, meaningfulLines, type Finding } from './findings';
import { currentMateriality, thresholdsOf, type PlanningState, type Thresholds } from './planning';

export interface MisstatementRow {
  findingId: string;
  title: string;
  cycle: string;
  impact: Impact;
  /** Sum of the debits of the proposed entry. */
  amount: Cents;
  /** Effect on the result: overstatement (presented result too high), understatement, or none (balance sheet or disclosure only). */
  direction: 'over' | 'under' | 'none';
  /** Proposed entry present (otherwise the finding is not quantified). */
  quantified: boolean;
  /** At or below the player's clearly trivial threshold: listed, not cumulated. */
  belowTrivial: boolean;
  /** At or above the player's materiality on the result or on equity. */
  individuallySignificant: boolean;
  /** Corrected by the client or not: filled by the negotiation (J6). */
  correctionStatus: null;
}

export interface FiguresSummary {
  result: Cents;
  equity: Cents;
  caf: Cents;
  netSelfFinancing: Cents;
  /** Net self-financing ratio of the year (share). */
  ratio: number;
}

export interface MisstatementTable {
  rows: MisstatementRow[];
  /** Thresholds in force (planning section), or null when no materiality was validated. */
  thresholds: Thresholds | null;
  /** Cumulated result impacts (rows above the trivial threshold). */
  overstatements: Cents;
  understatements: Cents;
  net: Cents;
  /** Cumulated equity impact (rows above the trivial threshold). */
  equityNet: Cents;
  /** Result impacts of the rows below the trivial threshold (not cumulated). */
  trivialTotal: Cents;
  /** Net cumulated result impact compared with the thresholds (null without thresholds). */
  comparison: { aboveMateriality: boolean; abovePlanning: boolean; aboveTrivial: boolean } | null;
  /** All the entries applied at once. */
  combined: Impact;
  presented: FiguresSummary;
  corrected: FiguresSummary;
  threeYear: { ratio2023: number; ratio2024: number; presented: number; corrected: number };
  referenceRates: { year: number; threeYears: number };
}

const presentedCache = new WeakMap<World, StateFigures>();

/** Figures of the presented accounts (balances, statements, key figures), cached per world. */
export function presentedFigures(world: World, params: Params): StateFigures {
  let f = presentedCache.get(world);
  if (!f) {
    f = stateFigures(world, params);
    presentedCache.set(world, f);
  }
  return f;
}

function summary(f: StateFigures): FiguresSummary {
  return { result: f.figures.netResult, equity: f.statements.lines['P_CP']?.current ?? 0, caf: f.figures.caf, netSelfFinancing: f.figures.netSelfFinancing, ratio: f.figures.netSelfFinancingRatio };
}

export interface MisstatementContext {
  world: World;
  params: Params;
  planning: PlanningState;
}

/** Findings that enter the table: status « constat ». */
export function tableFindings(findings: readonly Finding[]): Finding[] {
  return findings.filter((f) => f.status === 'finding');
}

export function misstatementTable(findings: readonly Finding[], ctx: MisstatementContext): MisstatementTable {
  const { world, params } = ctx;
  const presented = presentedFigures(world, params);
  const choice = currentMateriality(ctx.planning);
  const thresholds = choice ? thresholdsOf(choice) : null;
  const shown = tableFindings(findings);
  const fx = { world, params };
  const rows = shown.map((f): MisstatementRow => {
    const lines = meaningfulLines(f.proposedEntry);
    const impact = impactOfLines(presented, lines, fx);
    const amount = findingAmount({ proposedEntry: lines });
    const magnitude = impact.result !== 0 || impact.equity !== 0 ? Math.max(Math.abs(impact.result), Math.abs(impact.equity)) : amount;
    return {
      findingId: f.id,
      title: f.title,
      cycle: f.cycle,
      impact,
      amount,
      direction: impact.result > 0 ? 'over' : impact.result < 0 ? 'under' : 'none',
      quantified: lines.length > 0,
      belowTrivial: !!thresholds && lines.length > 0 && magnitude <= thresholds.trivial,
      individuallySignificant: !!thresholds && Math.max(Math.abs(impact.result), Math.abs(impact.equity)) >= thresholds.materiality,
      correctionStatus: null,
    };
  });
  let overstatements = 0;
  let understatements = 0;
  let equityNet = 0;
  let trivialTotal = 0;
  for (const r of rows) {
    if (r.belowTrivial) {
      trivialTotal += r.impact.result;
      continue;
    }
    if (r.impact.result > 0) overstatements += r.impact.result;
    else understatements += r.impact.result;
    equityNet += r.impact.equity;
  }
  const net = overstatements + understatements;
  const all = shown.flatMap((f) => meaningfulLines(f.proposedEntry));
  const after = figuresWithLines(presented, all, fx);
  const combined = impactOfLines(presented, all, fx);
  const ratio2023 = (params.scenario.history.find((h) => h.year === world.meta.priorYear - 1)?.netSelfFinancingRatioPct ?? 0) / 100;
  const ratio2024 = keyFigures(closingBalances(world.ledgers.prior), params.analysis, loanRepayments(world, world.meta.priorYear)).netSelfFinancingRatio;
  const p = summary(presented);
  const c = summary(after);
  return {
    rows,
    thresholds,
    overstatements,
    understatements,
    net,
    equityNet,
    trivialTotal,
    comparison: thresholds ? { aboveMateriality: Math.abs(net) >= thresholds.materiality, abovePlanning: Math.abs(net) >= thresholds.planning, aboveTrivial: Math.abs(net) > thresholds.trivial } : null,
    combined,
    presented: p,
    corrected: c,
    threeYear: { ratio2023, ratio2024, presented: (ratio2023 + ratio2024 + p.ratio) / 3, corrected: (ratio2023 + ratio2024 + c.ratio) / 3 },
    referenceRates: { year: params.regulatory.netSelfFinancing.referenceRateYearPct / 100, threeYears: params.regulatory.netSelfFinancing.referenceRate3YearsPct / 100 },
  };
}
