/**
 * Reference synthesis of the correction key (§5 « Synthèse de référence »):
 * impacts by anomaly, totals, results and net self-financing ratios presented
 * and corrected, position with respect to the materiality thresholds. Every
 * figure is computed from the correction entries.
 */
import { keyFigures } from '../../engine/analysis';
import { closingBalances } from '../../engine/balance';
import type { Cents } from '../../engine/money';
import type { World } from '../../engine/types';
import type { Params } from '../params';
import type { Target } from '../schema';
import { ANOMALIES } from './modules';
import { anomalyImpact, loanRepayments, type Correction, type CorrectionKey, type Impact } from './presented';
import type { AnomalyId } from './types';

export interface AnomalySummary {
  id: AnomalyId;
  title: string;
  impact: Impact;
  parts: readonly Correction[];
  target?: Target;
  equityTarget?: Target;
  withinTarget: boolean;
}

export interface Synthesis {
  anomalies: AnomalySummary[];
  /** Sum of positive (overstatement) and negative (understatement) result impacts. */
  overstatements: Cents;
  understatements: Cents;
  presentedResult: Cents;
  correctedResult: Cents;
  presentedRatio: number;
  correctedRatio: number;
  netSelfFinancingOverstatement: Cents;
  /** Mean of the ratios of the last three years (2023 from the history, 2024 certified, 2025). */
  threeYearPresented: number;
  threeYearCorrected: number;
  referenceRates: { year: number; threeYears: number };
  materiality: { overall: Cents; performance: Cents; trivial: Cents };
  aboveOverall: AnomalyId[];
  betweenPerformanceAndOverall: AnomalyId[];
}

export function checkTarget(value: number, t: Target): boolean {
  if (t.min !== undefined && value < t.min) return false;
  if (t.max !== undefined && value > t.max) return false;
  if (t.value !== undefined) {
    if (t.tol !== undefined && Math.abs(value - t.value) > t.tol + 1e-9) return false;
    if (t.tolPct !== undefined && Math.abs(value - t.value) > (Math.abs(t.value) * t.tolPct) / 100 + 1e-9) return false;
  }
  return true;
}

export function buildSynthesis(key: CorrectionKey, clean: World, params: Params): Synthesis {
  const targets = params.calibration.impacts;
  const target = (k: string) => (typeof targets[k] === 'object' ? (targets[k] as Target) : undefined);
  const anomalies = ANOMALIES.map((m): AnomalySummary => {
    const impact = anomalyImpact(key, m.id);
    const t = target(m.id);
    const et = target(`${m.id}.equity`);
    const ok = (!t || checkTarget(impact.result / 100, t)) && (!et || checkTarget(impact.equity / 100, et));
    return { id: m.id, title: m.title, impact, parts: key.corrections.filter((c) => c.anomalyId === m.id), ...(t ? { target: t } : {}), ...(et ? { equityTarget: et } : {}), withinTarget: ok };
  });
  const overstatements = anomalies.reduce((s, a) => s + Math.max(0, a.impact.result), 0);
  const understatements = anomalies.reduce((s, a) => s + Math.min(0, a.impact.result), 0);
  const p = key.presentedFigures.figures;
  const c = key.cleanFigures.figures;
  const f24 = keyFigures(closingBalances(clean.ledgers.prior), params.analysis, loanRepayments(clean, 2024));
  const r23 = (params.scenario.history.find((h) => h.year === 2023)?.netSelfFinancingRatioPct ?? 0) / 100;
  const m = params.regulatory.materiality.reference;
  const overall = Math.round(m.overallEuros * 100);
  const performance = Math.round(m.performanceEuros * 100);
  return {
    anomalies,
    overstatements,
    understatements,
    presentedResult: p.netResult,
    correctedResult: c.netResult,
    presentedRatio: p.netSelfFinancingRatio,
    correctedRatio: c.netSelfFinancingRatio,
    netSelfFinancingOverstatement: p.netSelfFinancing - c.netSelfFinancing,
    threeYearPresented: (r23 + f24.netSelfFinancingRatio + p.netSelfFinancingRatio) / 3,
    threeYearCorrected: (r23 + f24.netSelfFinancingRatio + c.netSelfFinancingRatio) / 3,
    referenceRates: { year: params.regulatory.netSelfFinancing.referenceRateYearPct / 100, threeYears: params.regulatory.netSelfFinancing.referenceRate3YearsPct / 100 },
    materiality: { overall, performance, trivial: Math.round(m.trivialEuros * 100) },
    aboveOverall: anomalies.filter((a) => Math.abs(a.impact.result) > overall).map((a) => a.id),
    betweenPerformanceAndOverall: anomalies.filter((a) => Math.abs(a.impact.result) > performance && Math.abs(a.impact.result) <= overall).map((a) => a.id),
  };
}
