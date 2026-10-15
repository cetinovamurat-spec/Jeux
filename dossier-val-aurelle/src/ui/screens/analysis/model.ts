/**
 * Data of the analytical review, derived from the case and memoised:
 * ratios of the two audited years (and of the clean world in designer mode),
 * net self-financing series, Livret A average rates, monthly billed rents.
 */
import { useMemo } from 'react';
import { keyFigures, type KeyFigures } from '../../../engine/analysis';
import { closingBalances } from '../../../engine/balance';
import type { Cents } from '../../../engine/money';
import type { World } from '../../../engine/types';
import { hlmRatios, monthlyCredits, netSelfFinancingSeries, sumRule, timeWeightedRate, type AverageRate, type HlmRatios, type RatioConventions, type YearRatio } from '../../../game/analysis';
import { loanRepayments } from '../../../scenario/anomalies/presented';
import type { ScenarioDatasets } from '../../../scenario/datasets';
import { vacancy, type VacancyFigures } from '../../../scenario/report';
import type { CaseData, Year } from '../../app/case';
import { useCase } from '../../app/context';
import { useDesigner } from '../../app/hooks';

export interface YearAnalysis {
  year: number;
  figures: KeyFigures;
  vacancy: VacancyFigures;
  ratios: HlmRatios;
  /** Components shown next to the ratios. */
  billedRentsAndCharges: Cents;
  receivables: Cents;
  interest: Cents;
}

function yearAnalysis(year: number, figures: KeyFigures, balances: ReadonlyMap<string, Cents>, ds: ScenarioDatasets, conv: RatioConventions): YearAnalysis {
  const vac = vacancy(ds, year);
  const ratios = hlmRatios({
    balances,
    rents: figures.rents,
    ebeOnRents: figures.ebeOnRents,
    loanRepayments: figures.loanRepayments,
    financialCharges: figures.financialCharges,
    netSelfFinancingRatio: figures.netSelfFinancingRatio,
    dwellings: vac.stock,
    vacancyRate: vac.totalRate,
  }, conv);
  return { year, figures, vacancy: vac, ratios, billedRentsAndCharges: ratios.arrears.billedRentsAndCharges, receivables: ratios.arrears.receivables, interest: sumRule(balances, conv.loanInterest) };
}

export interface RatioSet {
  current: YearAnalysis;
  prior: YearAnalysis;
  /** Net self-financing ratio by year: history (2021-2023) then the two audited years. */
  series: YearRatio[];
}

function datasetsOf(w: World): ScenarioDatasets {
  return w.datasets as unknown as ScenarioDatasets;
}

function presentedRatios(c: CaseData): RatioSet {
  const { current: cy, prior: py } = c.params.scenario.years;
  const b = c.balances();
  const f = c.figures();
  const current = yearAnalysis(cy, f.y2025, b.current, c.datasets, c.params.analysis.review.hlmRatios);
  const prior = yearAnalysis(py, f.y2024, b.prior, c.datasets, c.params.analysis.review.hlmRatios);
  const series = netSelfFinancingSeries(c.params.scenario.history, [
    { year: py, ratio: prior.figures.netSelfFinancingRatio },
    { year: cy, ratio: current.figures.netSelfFinancingRatio },
  ]);
  return { current, prior, series };
}

/** Designer mode only: the same figures on the clean world (corrected accounts, certified 2024 accounts). */
function cleanRatios(c: CaseData): RatioSet {
  const { current: cy, prior: py } = c.params.scenario.years;
  const ds = datasetsOf(c.clean);
  const priorBalances = closingBalances(c.clean.ledgers.prior);
  const current = yearAnalysis(cy, c.key.cleanFigures.figures, c.key.cleanFigures.balances, ds, c.params.analysis.review.hlmRatios);
  const prior = yearAnalysis(py, keyFigures(priorBalances, c.params.analysis, loanRepayments(c.clean, py)), priorBalances, ds, c.params.analysis.review.hlmRatios);
  const series = netSelfFinancingSeries(c.params.scenario.history, [
    { year: py, ratio: prior.figures.netSelfFinancingRatio },
    { year: cy, ratio: current.figures.netSelfFinancingRatio },
  ]);
  return { current, prior, series };
}

export function useRatios(): { presented: RatioSet; clean: RatioSet | null } {
  const c = useCase();
  const designer = useDesigner();
  const presented = useMemo(() => presentedRatios(c), [c]);
  const clean = useMemo(() => (designer ? cleanRatios(c) : null), [c, designer]);
  return { presented, clean };
}

export function useLivretA(): { current: AverageRate; prior: AverageRate } {
  const c = useCase();
  return useMemo(() => {
    const { current, prior } = c.params.scenario.years;
    const h = c.params.regulatory.livretA.history;
    return { current: timeWeightedRate(h, current), prior: timeWeightedRate(h, prior) };
  }, [c]);
}

export interface MonthRow {
  /** 1 to 12 */
  month: number;
  prior: Cents;
  current: Cents;
}

/** Billed rents (rents only, charges and RLS excluded) by month of the entry date, both years, from the FEC (opening entries excluded). */
export function useMonthlyRents(): MonthRow[] {
  const c = useCase();
  return useMemo(() => {
    const { current, prior } = c.params.scenario.years;
    const cur = monthlyCredits(c.fec(current as Year), c.params.analysis.review.hlmRatios.monthlyRents);
    const pri = monthlyCredits(c.fec(prior as Year), c.params.analysis.review.hlmRatios.monthlyRents);
    return cur.map((v, i) => ({ month: i + 1, prior: pri[i] ?? 0, current: v }));
  }, [c]);
}
