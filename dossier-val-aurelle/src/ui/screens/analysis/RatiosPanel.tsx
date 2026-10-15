/**
 * HLM ratios of the presented accounts (2024 and 2025, plus the 2021-2023
 * history of the net self-financing ratio), their components, and the Livret
 * A average rate next to the variation of the financial charges. Conventions
 * are proposals to validate; nothing here depends on the anomalies of the case
 * (the designer mode adds the ratios of the clean accounts).
 */
import { Fragment, type ReactNode } from 'react';
import { formatDateFr } from '../../../engine/dates';
import { formatEuro, formatPercent } from '../../../engine/format';
import { meetsReference, trailingMean, variation, type AverageRate } from '../../../game/analysis';
import { useCase } from '../../app/context';
import { Amount } from '../../components/Amount';
import { Badge, Card, cx } from '../../components/ui';
import { formatCount } from '../balance/format';
import { Signed } from '../balance/tableParts';
import { formatPoints, formatRatePct, formatSignedPercent, ratioTexts, ruleText, type RatioText } from './labels';
import { useLivretA, useRatios, type RatioSet, type YearAnalysis } from './model';

type RatioId = 'netSelfFinancing' | 'mean3' | 'ebeOnRents' | 'debtService' | 'financialCharges' | 'vacancy' | 'arrears' | 'managementCost';

interface RatioRow {
  id: RatioId;
  text: RatioText;
  /** Sub-row of the previous one (indented). */
  sub?: boolean;
  unit: 'ratio' | 'cents';
  value: (year: number) => number | null;
  /** Numerator and denominator of the year (cell title). */
  detail?: (y: YearAnalysis) => string;
  reference?: { pct: number; label: string };
}

const wholeEuros = (cents: number) => formatEuro(cents, 0);

function ratioRows(set: RatioSet, texts: ReturnType<typeof ratioTexts>, refs: { year: number; threeYears: number }): RatioRow[] {
  const byYear = new Map<number, YearAnalysis>([
    [set.current.year, set.current],
    [set.prior.year, set.prior],
  ]);
  const at = <T,>(year: number, f: (y: YearAnalysis) => T): T | null => {
    const y = byYear.get(year);
    return y ? f(y) : null;
  };
  return [
    {
      id: 'netSelfFinancing',
      text: texts.netSelfFinancing,
      unit: 'ratio',
      value: (year) => set.series.find((s) => s.year === year)?.ratio ?? null,
      detail: (y) => `Autofinancement net : ${wholeEuros(y.figures.netSelfFinancing)} ; dénominateur : ${wholeEuros(y.figures.denominator)}`,
      reference: { pct: refs.year, label: 'de l’exercice' },
    },
    { id: 'mean3', text: texts.mean3, sub: true, unit: 'ratio', value: (year) => trailingMean(set.series, year), reference: { pct: refs.threeYears, label: 'sur trois exercices' } },
    { id: 'ebeOnRents', text: texts.ebeOnRents, unit: 'ratio', value: (year) => at(year, (y) => y.ratios.ebeOnRents), detail: (y) => `EBE : ${wholeEuros(y.figures.ebe)} ; loyers : ${wholeEuros(y.figures.rents)}` },
    {
      id: 'debtService',
      text: texts.debtService,
      unit: 'ratio',
      value: (year) => at(year, (y) => y.ratios.debtService.ratio),
      detail: (y) =>
        `Annuités : ${wholeEuros(y.ratios.debtService.annuities)} (capital ${wholeEuros(y.ratios.debtService.repayments)} + intérêts ${wholeEuros(y.ratios.debtService.interest)}) ; loyers : ${wholeEuros(y.figures.rents)}`,
    },
    {
      id: 'financialCharges',
      text: texts.financialCharges,
      unit: 'ratio',
      value: (year) => at(year, (y) => y.ratios.financialChargesOnRents.ratio),
      detail: (y) => `Frais financiers : ${wholeEuros(y.figures.financialCharges)} ; loyers : ${wholeEuros(y.figures.rents)}`,
    },
    {
      id: 'vacancy',
      text: texts.vacancy,
      unit: 'ratio',
      value: (year) => at(year, (y) => y.ratios.vacancy.rate),
      detail: (y) => `${formatCount(y.vacancy.vacant)} logements vacants sur ${formatCount(y.vacancy.stock)}`,
    },
    {
      id: 'arrears',
      text: texts.arrears,
      unit: 'ratio',
      value: (year) => at(year, (y) => y.ratios.arrears.ratio),
      detail: (y) => `Créances locatives brutes : ${wholeEuros(y.receivables)} ; loyers quittancés : ${wholeEuros(y.billedRents)}`,
    },
    {
      id: 'managementCost',
      text: texts.managementCost,
      unit: 'cents',
      value: (year) => at(year, (y) => y.ratios.managementCost.perDwelling),
      detail: (y) => `Coût de gestion : ${wholeEuros(y.ratios.managementCost.cost)} ; logements : ${formatCount(y.ratios.managementCost.dwellings)}`,
    },
  ];
}

function RatioValue({ unit, value, strong }: { unit: RatioRow['unit']; value: number | null; strong?: boolean }) {
  if (value === null) return <span className="num text-muted">—</span>;
  if (unit === 'cents') return <span className={cx('num', strong && 'font-semibold')}>{wholeEuros(value)}</span>;
  return <span className={cx('num', strong && 'font-semibold')}>{formatPercent(value, 1)}</span>;
}

function change(row: RatioRow, current: number, prior: number): string {
  if (row.unit === 'cents') return formatSignedPercent(variation(prior, current).ratio, 1);
  return formatPoints(current - prior, 1);
}

function RatiosTable() {
  const c = useCase();
  const { presented, clean } = useRatios();
  const { current, prior } = c.params.scenario.years;
  const ref = c.params.regulatory.netSelfFinancing;
  const texts = ratioTexts(c.params.analysis);
  const refs = { year: ref.referenceRateYearPct, threeYears: ref.referenceRate3YearsPct };
  const rows = ratioRows(presented, texts, refs);
  const cleanRows = clean ? new Map(ratioRows(clean, texts, refs).map((r) => [r.id, r])) : null;
  const years = [...new Set([...presented.series.map((s) => s.year), prior, current])].sort((a, b) => a - b);
  const byYear = new Map<number, YearAnalysis>([
    [current, presented.current],
    [prior, presented.prior],
  ]);
  const head = 'px-2 py-1.5 text-right font-medium';
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[42rem] text-sm">
        <caption className="sr-only">
          Ratios HLM des comptes présentés, exercices {years[0]} à {current}
        </caption>
        <thead className="text-xs text-muted">
          <tr>
            <th scope="col" className="py-1.5 pl-3 pr-2 text-left font-medium">
              Ratio et définition
            </th>
            {years.map((y) => (
              <th key={y} scope="col" className={cx(head, 'w-[4.5rem]', y === current && 'text-ink')} title={y < prior ? 'Exercice antérieur : agrégats communiqués par la société' : undefined}>
                {y}
              </th>
            ))}
            <th scope="col" className={cx(head, 'w-[5.5rem]')}>
              Évolution {current}
            </th>
            <th scope="col" className="w-[10rem] py-1.5 pl-2 pr-3 text-left font-medium">
              Taux de référence
            </th>
            {cleanRows && (
              <th scope="col" className={cx(head, 'w-[5.5rem] pr-3 text-warn')}>
                Propre {current}
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const cur = r.value(current);
            const pri = r.value(prior);
            const cleanValue = cleanRows?.get(r.id)?.value(current) ?? null;
            const defId = `an-ratio-def-${r.id}`;
            return (
              <Fragment key={r.id}>
                <tr className={cx('border-t border-line align-top', r.sub && 'bg-sunken/60')}>
                  <th scope="row" aria-describedby={defId} className={cx('pb-0.5 pr-2 pt-1.5 text-left', r.sub ? 'pl-7 font-normal' : 'pl-3 font-medium')}>
                    {r.text.label}
                  </th>
                  {years.map((y) => {
                    const y0 = byYear.get(y);
                    return (
                      <td key={y} className="px-2 py-1.5 text-right" title={y0 && r.detail ? r.detail(y0) : undefined}>
                        <RatioValue unit={r.unit} value={r.value(y)} strong={y === current} />
                      </td>
                    );
                  })}
                  <td className="num px-2 py-1.5 text-muted">{cur !== null && pri !== null ? change(r, cur, pri) : '—'}</td>
                  <td className="py-1.5 pl-2 pr-3 text-xs">
                    {r.reference ? (
                      <span className="flex flex-col items-start gap-1">
                        <span>
                          <span className="num font-semibold">{formatRatePct(r.reference.pct)}</span> <span className="text-muted">{r.reference.label}</span>
                        </span>
                        {cur !== null &&
                          (meetsReference(cur, r.reference.pct) ? (
                            <Badge tone="ok" title={`Ratio ${current} supérieur ou égal au taux de référence paramétré`}>
                              ✓ Atteint en {current}
                            </Badge>
                          ) : (
                            <Badge tone="ko" title={`Ratio ${current} inférieur au taux de référence paramétré`}>
                              ✗ Non atteint en {current}
                            </Badge>
                          ))}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  {cleanRows && (
                    <td className="px-2 py-1.5 pr-3 text-right text-warn">
                      <RatioValue unit={r.unit} value={cleanValue} />
                    </td>
                  )}
                </tr>
                <tr className={cx(r.sub && 'bg-sunken/60')}>
                  <td id={defId} colSpan={years.length + 3 + (cleanRows ? 1 : 0)} className={cx('pb-2 pr-3 pt-0 text-xs leading-snug text-muted', r.sub ? 'pl-7' : 'pl-3')}>
                    {r.text.definition}
                  </td>
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ComponentsTable() {
  const c = useCase();
  const { presented: p } = useRatios();
  const { current, prior } = c.params.scenario.years;
  const a = c.params.analysis;
  const conv = c.params.analysis.review.hlmRatios;
  const amounts: { label: string; get: (y: YearAnalysis) => number; strong?: boolean }[] = [
    { label: `Loyers nets de RLS (comptes ${ruleText(a.rents)})`, get: (y) => y.figures.rents, strong: true },
    { label: 'Excédent brut d’exploitation', get: (y) => y.figures.ebe },
    { label: 'Capacité d’autofinancement', get: (y) => y.figures.caf },
    { label: 'Remboursements en capital des emprunts locatifs (hors anticipés)', get: (y) => y.figures.loanRepayments },
    { label: 'Autofinancement net HLM', get: (y) => y.figures.netSelfFinancing, strong: true },
    { label: 'Dénominateur du ratio d’autofinancement net', get: (y) => y.figures.denominator },
    { label: `Intérêts des emprunts (comptes ${ruleText(conv.loanInterest)})`, get: (y) => y.interest },
    { label: 'Annuités (capital + intérêts)', get: (y) => y.ratios.debtService.annuities, strong: true },
    { label: `Frais financiers (comptes ${ruleText(a.financialCharges)})`, get: (y) => y.figures.financialCharges },
    { label: `Créances locatives brutes (comptes ${ruleText(conv.rentReceivables)})`, get: (y) => y.receivables },
    { label: `Loyers quittancés (comptes ${ruleText(conv.billedRents)})`, get: (y) => y.billedRents },
    { label: 'Coût de gestion', get: (y) => y.ratios.managementCost.cost },
  ];
  const counts: { label: string; get: (y: YearAnalysis) => number }[] = [
    { label: 'Logements familiaux en service au 31/12', get: (y) => y.vacancy.stock },
    { label: 'dont sans bail en cours au 31/12', get: (y) => y.vacancy.vacant },
  ];
  const head = 'px-2 py-1.5 text-right font-medium';
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] text-sm">
        <caption className="sr-only">
          Composantes des ratios HLM, exercices {current} et {prior}
        </caption>
        <thead className="text-xs text-muted">
          <tr className="border-b border-line">
            <th scope="col" className="py-1.5 pl-3 pr-2 text-left font-medium">
              Agrégat (euros)
            </th>
            <th scope="col" className={cx(head, 'text-ink')}>
              {current}
            </th>
            <th scope="col" className={head}>
              {prior}
            </th>
            <th scope="col" className={cx(head, 'pr-3')}>
              Variation
            </th>
          </tr>
        </thead>
        <tbody>
          {amounts.map((r) => {
            const cur = r.get(p.current);
            const pri = r.get(p.prior);
            return (
              <tr key={r.label} className="border-b border-line">
                <th scope="row" className={cx('py-1 pl-3 pr-2 text-left', r.strong ? 'font-medium' : 'font-normal')}>
                  {r.label}
                </th>
                <td className="px-2 py-1 text-right">
                  <Signed cents={cur} decimals={0} strong={r.strong} />
                </td>
                <td className="px-2 py-1 text-right">
                  <Signed cents={pri} decimals={0} />
                </td>
                <td className="num px-2 py-1 pr-3 text-muted">{formatSignedPercent(variation(pri, cur).ratio, 1)}</td>
              </tr>
            );
          })}
          {counts.map((r) => {
            const cur = r.get(p.current);
            const pri = r.get(p.prior);
            return (
              <tr key={r.label} className="border-b border-line last:border-b-0">
                <th scope="row" className="py-1 pl-3 pr-2 text-left font-normal">
                  {r.label} <span className="text-muted">(nombre)</span>
                </th>
                <td className="num px-2 py-1">{formatCount(cur)}</td>
                <td className="num px-2 py-1">{formatCount(pri)}</td>
                <td className="num px-2 py-1 pr-3 text-muted">{formatSignedPercent(variation(pri, cur).ratio, 1)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Periods({ rate }: { rate: AverageRate }) {
  return (
    <div>
      <p className="text-xs font-medium">Taux en vigueur en {rate.year}</p>
      <ul className="mt-0.5 space-y-0.5 text-xs text-muted">
        {rate.periods.map((p) => (
          <li key={p.from}>
            du {formatDateFr(p.from).slice(0, 5)} au {formatDateFr(p.to).slice(0, 5)} : <span className="num text-ink">{formatPercent(p.ratePct / 100, 2)}</span> ({formatCount(p.days)} j)
          </li>
        ))}
        {rate.coveredDays < rate.daysInYear && <li className="text-warn">Historique incomplet : {formatCount(rate.daysInYear - rate.coveredDays)} jours sans taux connu.</li>}
      </ul>
    </div>
  );
}

function LivretACard() {
  const c = useCase();
  const la = useLivretA();
  const { presented: p } = useRatios();
  const { current, prior } = c.params.scenario.years;
  const conv = c.params.analysis.review.hlmRatios;
  const avgCur = la.current.averagePct;
  const avgPri = la.prior.averagePct;
  const rows: { label: ReactNode; cur: ReactNode; pri: ReactNode; change: ReactNode; strong?: boolean }[] = [
    {
      label: 'Taux moyen du Livret A',
      cur: avgCur === null ? '—' : formatPercent(avgCur / 100, 2),
      pri: avgPri === null ? '—' : formatPercent(avgPri / 100, 2),
      change:
        avgCur === null || avgPri === null ? (
          '—'
        ) : (
          <>
            {formatPoints((avgCur - avgPri) / 100, 2)}
            <span className="block text-[11px]">soit {formatSignedPercent(variation(avgPri, avgCur).ratio, 1)}</span>
          </>
        ),
      strong: true,
    },
    {
      label: 'Frais financiers',
      cur: <Amount cents={p.current.figures.financialCharges} />,
      pri: <Amount cents={p.prior.figures.financialCharges} />,
      change: formatSignedPercent(variation(p.prior.figures.financialCharges, p.current.figures.financialCharges).ratio, 1),
      strong: true,
    },
    {
      label: <>dont intérêts des emprunts ({ruleText(conv.loanInterest)})</>,
      cur: <Amount cents={p.current.interest} />,
      pri: <Amount cents={p.prior.interest} />,
      change: formatSignedPercent(variation(p.prior.interest, p.current.interest).ratio, 1),
    },
  ];
  const livretA = c.params.regulatory.livretA;
  return (
    <Card title="Livret A et frais financiers">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[26rem] text-sm">
          <caption className="sr-only">
            Taux moyen du Livret A et frais financiers, exercices {current} et {prior}
          </caption>
          <thead className="text-xs text-muted">
            <tr className="border-b border-line">
              <th scope="col" className="py-1.5 pl-3 pr-2 text-left font-medium">
                <span className="sr-only">Indicateur</span>
              </th>
              <th scope="col" className="px-2 py-1.5 text-right font-medium text-ink">
                {current}
              </th>
              <th scope="col" className="px-2 py-1.5 text-right font-medium">
                {prior}
              </th>
              <th scope="col" className="px-2 py-1.5 pr-3 text-right font-medium">
                Évolution
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-line">
                <th scope="row" className={cx('py-1 pl-3 pr-2 text-left', r.strong ? 'font-medium' : 'pl-6 font-normal')}>
                  {r.label}
                </th>
                <td className="num px-2 py-1 font-semibold">{r.cur}</td>
                <td className="num px-2 py-1">{r.pri}</td>
                <td className="num px-2 py-1 pr-3 align-top text-muted">{r.change}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 px-3 py-2.5 sm:grid-cols-2">
        <Periods rate={la.prior} />
        <Periods rate={la.current} />
      </div>
      <p className="border-t border-line px-3 py-2 text-xs text-muted">
        Moyenne des taux en vigueur pondérée par le nombre de jours de l’exercice ; un taux s’applique à compter de sa date d’effet. Les intérêts des prêts indexés dépendent du taux en vigueur à leurs dates de révision,
        propres à chaque contrat.
        {livretA.toVerify && ' Historique des taux paramétré, à vérifier.'}
      </p>
    </Card>
  );
}

export function RatiosPanel() {
  const c = useCase();
  const ref = c.params.regulatory.netSelfFinancing;
  return (
    <div className="space-y-3">
      <Card title="Ratios HLM des comptes présentés" actions={<span className="text-xs text-muted">Conventions de calcul proposées, à valider</span>}>
        <RatiosTable />
        <p className="border-t border-line px-3 py-2 text-xs text-muted">
          Taux de référence de l’autofinancement net paramétrés : {formatRatePct(ref.referenceRateYearPct)} pour l’exercice et {formatRatePct(ref.referenceRate3YearsPct)} en moyenne sur trois exercices (
          {ref.threeYearMethod === 'meanOfRatios' ? 'moyenne des ratios' : 'ratio des cumuls'}){ref.toVerify ? ', valeurs à vérifier' : ''}. Survolez une valeur pour voir son numérateur et son dénominateur ; ils figurent
          aussi dans les composantes ci-dessous.
        </p>
      </Card>
      <div className="grid items-start gap-3 xl:grid-cols-2">
        <Card title="Composantes des ratios">
          <ComponentsTable />
        </Card>
        <LivretACard />
      </div>
    </div>
  );
}
