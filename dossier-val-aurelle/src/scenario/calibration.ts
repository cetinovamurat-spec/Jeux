/** Calibration targets vs values obtained on the clean world (used by tests, report and control screen). */
import { closingBalances, sumPrefixes } from '../engine/balance';
import { formatAmount, formatPercent } from '../engine/format';
import type { Cents } from '../engine/money';
import { buildStatements } from '../engine/statements';
import type { GenerationResult } from './generator';
import type { CorrectionKey } from './anomalies/presented';
import type { ScenarioDatasets } from './datasets';
import type { Params } from './params';
import type { Target } from './schema';

export interface CalibrationRow {
  year: number | 'J2' | 'présenté 2025';
  key: string;
  label: string;
  value: number;
  target: Target;
  targetText: string;
  valueText: string;
  ok: boolean;
}

const LABELS: Record<string, string> = {
  rentsNet: 'Loyers nets de RLS',
  rls: 'Réduction de loyer de solidarité',
  chargeRecoveries: 'Récupération des charges locatives',
  ebeOnRentsPct: 'EBE / loyers',
  financialCharges: 'Frais financiers',
  debt: 'Emprunts (capital restant dû)',
  loanRepayments: 'Remboursements en capital (hors anticipés)',
  disposalGains: 'Plus-values nettes de cessions',
  netResult: 'Résultat net',
  netSelfFinancingRatioPct: "Ratio d'autofinancement net HLM",
  totalAssets: 'Total du bilan',
  equity: 'Capitaux propres',
  investmentSubsidies: "Subventions d'investissement (nettes)",
  cash: 'Trésorerie',
  deposits: 'Dépôts de garantie des locataires',
  pgeOpening: 'PGE – ouverture',
  pgeDotation: 'PGE – dotation',
  pgeReprise: 'PGE – reprise',
  pgeClosing: 'PGE – clôture',
  icneFlatRateErrorA08: 'A08 – écart ICNE au taux unique de 3 %',
  rentExcessA17: 'A17 – loyers perçus au-delà de +3,26 %',
  rentBatchSaulesOctoberA19: 'A19 – lot de quittancement d’octobre (Les Saules)',
  closFleuriNbvA03: 'A03 – valeur nette des 7 pavillons du Clos Fleuri',
  presentedImpairmentChargeA21: 'A21 – dotation aux dépréciations présentée',
  receivablesImpairmentCharge: 'Dotation aux dépréciations des créances',
};

function check(value: number, t: Target): boolean {
  if (t.min !== undefined && value < t.min) return false;
  if (t.max !== undefined && value > t.max) return false;
  if (t.value !== undefined) {
    if (t.tol !== undefined && Math.abs(value - t.value) > t.tol + 1e-9) return false;
    if (t.tolPct !== undefined && Math.abs(value - t.value) > (Math.abs(t.value) * t.tolPct) / 100 + 1e-9) return false;
  }
  return true;
}

function targetText(t: Target, pct: boolean): string {
  const f = (x: number) => (pct ? `${x.toLocaleString('fr-FR')} %` : `${formatAmount(Math.round(x * 100), 0)}`);
  if (t.min !== undefined || t.max !== undefined) return `${f(t.min ?? -Infinity)} – ${f(t.max ?? Infinity)}`;
  if (t.tolPct !== undefined) return `${f(t.value!)} ± ${t.tolPct} %`;
  if (t.tol !== undefined) return t.tol === 0 ? `${f(t.value!)} (exact)` : `${f(t.value!)} ± ${pct ? t.tol : formatAmount(Math.round(t.tol * 100), 0)}`;
  return f(t.value ?? 0);
}

export function cleanValues(r: GenerationResult, params: Params, year: 2024 | 2025): Record<string, number> {
  const ledger = year === 2025 ? r.world.ledgers.current : r.world.ledgers.prior;
  const prior = year === 2025 ? r.world.ledgers.prior : r.world.ledgers.prior;
  const b = closingBalances(ledger);
  const f = year === 2025 ? r.figures.y2025 : r.figures.y2024;
  const fs = buildStatements({ defs: params.statements, chart: r.world.chart, current: b, prior: closingBalances(prior), currentYear: year, priorYear: year - 1, presentation: r.world.presentation });
  const eur = (c: Cents) => c / 100;
  const pge = r.state.pge.find((p) => p.year === year)!;
  return {
    rentsNet: eur(f.rents),
    rls: eur(sumPrefixes(b, ['70491'])),
    chargeRecoveries: eur(f.chargeRecoveries),
    ebeOnRentsPct: f.ebeOnRents * 100,
    financialCharges: eur(f.financialCharges),
    debt: eur(-sumPrefixes(b, ['1631', '1641', '1678'])),
    loanRepayments: eur(f.loanRepayments),
    disposalGains: eur(f.disposalGains),
    netResult: eur(f.netResult),
    netSelfFinancingRatioPct: f.netSelfFinancingRatio * 100,
    totalAssets: eur(fs.checks.assetsTotal),
    equity: eur(fs.lines['P_CP']!.current),
    investmentSubsidies: eur(fs.lines['P_SUBV']!.current),
    cash: eur(sumPrefixes(b, ['512'])),
    deposits: eur(-sumPrefixes(b, ['1651'])),
    pgeOpening: eur(pge.opening),
    pgeDotation: eur(pge.dotation),
    pgeReprise: eur(pge.reprise),
    pgeClosing: eur(pge.closing),
  };
}

export function calibrationRows(r: GenerationResult, params: Params): CalibrationRow[] {
  const rows: CalibrationRow[] = [];
  for (const year of [2025, 2024] as const) {
    const targets = params.calibration.clean[String(year)] ?? {};
    const values = cleanValues(r, params, year);
    for (const [key, t] of Object.entries(targets)) {
      const value = values[key];
      if (value === undefined) continue;
      const pct = key.endsWith('Pct');
      rows.push({ year, key, label: LABELS[key] ?? key, value, target: t, targetText: targetText(t, pct), valueText: pct ? formatPercent(value / 100, 2) : formatAmount(Math.round(value * 100), 0), ok: check(value, t) });
    }
  }
  for (const [key, t] of Object.entries(params.calibration.anomalyMetrics)) {
    if (typeof t === 'string') continue;
    const value = (r.state.metrics[key.replace('presentedImpairmentChargeA21', 'presentedImpairmentCharge')] ?? NaN) / 100;
    rows.push({ year: 'J2', key, label: LABELS[key] ?? key, value, target: t, targetText: targetText(t, false), valueText: formatAmount(Math.round(value * 100), 0), ok: check(value, t) });
  }
  return rows;
}

/** Values of the presented 2025 accounts (§4.3 targets). */
export function presentedValues(key: CorrectionKey): Record<string, number> {
  const b = key.presentedFigures.balances;
  const f = key.presentedFigures.figures;
  const fs = key.presentedFigures.statements;
  const pge = (key.presented.world.datasets as unknown as ScenarioDatasets).pge.find((p) => p.year === 2025)!;
  const eur = (c: Cents) => c / 100;
  return {
    rentsNet: eur(f.rents),
    rls: eur(sumPrefixes(b, ['70491'])),
    chargeRecoveries: eur(f.chargeRecoveries),
    ebeOnRentsPct: f.ebeOnRents * 100,
    financialCharges: eur(f.financialCharges),
    debt: eur(-sumPrefixes(b, ['1631', '1641', '1678'])),
    loanRepayments: eur(f.loanRepayments),
    disposalGains: eur(f.disposalGains),
    netResult: eur(f.netResult),
    netSelfFinancingRatioPct: f.netSelfFinancingRatio * 100,
    totalAssets: eur(fs.checks.assetsTotal),
    equity: eur(fs.lines['P_CP']!.current),
    investmentSubsidies: eur(fs.lines['P_SUBV']!.current),
    cash: eur(sumPrefixes(b, ['512'])),
    receivablesImpairmentCharge: eur(sumPrefixes(b, ['68174'])),
    pgeOpening: eur(pge.opening),
    pgeDotation: eur(pge.dotation),
    pgeReprise: eur(pge.reprise),
    pgeClosing: eur(pge.closing),
  };
}

export function presentedRows(key: CorrectionKey, params: Params): CalibrationRow[] {
  const values = presentedValues(key);
  const rows: CalibrationRow[] = [];
  for (const [k, t] of Object.entries(params.calibration.presented['2025'] ?? {})) {
    const value = values[k];
    if (value === undefined) continue;
    const pct = k.endsWith('Pct');
    rows.push({ year: 'présenté 2025', key: k, label: LABELS[k] ?? k, value, target: t, targetText: targetText(t, pct), valueText: pct ? formatPercent(value / 100, 2) : formatAmount(Math.round(value * 100), 0), ok: check(value, t) });
  }
  return rows;
}
