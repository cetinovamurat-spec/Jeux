/**
 * Charts of the analytical review (Recharts): monthly billed rents of the two
 * years, net self-financing ratio over five years against the reference rate,
 * financial charges next to the Livret A average rate (small multiples, no
 * dual axis), structure of the charges. Each chart has a data table.
 */
import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, ReferenceLine, Tooltip, XAxis, YAxis } from 'recharts';
import { formatEuro, formatPercent } from '../../../engine/format';
import { chargeLines, RATIO_CONVENTIONS, trailingMean, variation } from '../../../game/analysis';
import { useCase } from '../../app/context';
import { Amount } from '../../components/Amount';
import { Signed } from '../balance/tableParts';
import { activeDatum, AXIS_LINE, AXIS_TICK, ChartCard, DataTableView, GRID_STROKE, Legend, SERIES, TooltipBox, type LegendItem } from './chartParts';
import { axisEuro, axisPercent, euroTickFormat, formatPoints, formatRatePct, formatSignedPercent, listFr, MONTHS_LONG, MONTHS_SHORT, niceTicks, shorten } from './labels';
import { useLivretA, useMonthlyRents, useRatios } from './model';

const wholeEuros = (cents: number) => formatEuro(cents, 0);
const KEYBOARD_HINT = 'Flèches gauche et droite : parcourir les points du graphique ; les valeurs figurent aussi dans « Voir les données ».';

function useYears() {
  const c = useCase();
  return c.params.scenario.years;
}

function yearLegend(prior: number, current: number, shape: LegendItem['shape']): LegendItem[] {
  return [
    { name: String(prior), color: SERIES.prior, shape },
    { name: String(current), color: SERIES.current, shape },
  ];
}

// ---------------------------------------------------------------------------
// (1) Monthly billed rents
// ---------------------------------------------------------------------------

interface MonthDatum {
  month: number;
  label: string;
  prior: number;
  current: number;
}

function MonthlyRentsChart() {
  const c = useCase();
  const { current, prior } = useYears();
  const rows = useMonthlyRents();
  const data = useMemo((): MonthDatum[] => rows.map((r) => ({ ...r, label: MONTHS_SHORT[r.month - 1] ?? String(r.month) })), [rows]);
  const ticks = useMemo(() => {
    const values = rows.flatMap((r) => [r.current, r.prior]);
    return niceTicks(Math.min(...values), Math.max(...values), 5);
  }, [rows]);
  const tickFormat = useMemo(() => euroTickFormat(ticks), [ticks]);
  const totalCur = rows.reduce((s, r) => s + r.current, 0);
  const totalPri = rows.reduce((s, r) => s + r.prior, 0);
  const left = RATIO_CONVENTIONS.billedRents.include.filter((a) => !RATIO_CONVENTIONS.monthlyRents.includes(a));
  const accountsText = (list: readonly string[]) => listFr(list.map((a) => `${a} (${c.accountLabel(a).toLowerCase()})`));
  return (
    <ChartCard
      id="rents"
      className="xl:col-span-2"
      title="Loyers quittancés mensuels"
      description={
        <>
          Crédits des comptes {accountsText(RATIO_CONVENTIONS.monthlyRents)} par mois de la date d’écriture du FEC, à-nouveaux exclus.
          {left.length > 0 && <> Non retenus : {accountsText(left)}.</>}
        </>
      }
      legend={<Legend items={yearLegend(prior, current, 'line')} />}
      summary={
        <>
          Cumul {current} : <span className="num text-ink">{wholeEuros(totalCur)}</span> ({formatSignedPercent(variation(totalPri, totalCur).ratio, 1)})
        </>
      }
      table={
        <DataTableView
          caption={`Loyers quittancés par mois, ${prior} et ${current}`}
          head={['Mois', String(current), String(prior), 'Variation (€)', 'Variation (%)']}
          rows={rows.map((r) => [
            MONTHS_LONG[r.month - 1],
            <Signed key="c" cents={r.current} decimals={0} />,
            <Signed key="p" cents={r.prior} decimals={0} />,
            <Signed key="v" cents={r.current - r.prior} decimals={0} />,
            formatSignedPercent(variation(r.prior, r.current).ratio, 1),
          ])}
          foot={[
            'Total',
            <Signed key="c" cents={totalCur} decimals={0} strong />,
            <Signed key="p" cents={totalPri} decimals={0} strong />,
            <Signed key="v" cents={totalCur - totalPri} decimals={0} strong />,
            formatSignedPercent(variation(totalPri, totalCur).ratio, 1),
          ]}
        />
      }
    >
      <LineChart responsive title={`Loyers quittancés mensuels ${prior} et ${current}`} desc={KEYBOARD_HINT} style={{ width: '100%', height: 240 }} data={data} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
        <CartesianGrid vertical={false} stroke={GRID_STROKE} />
        <XAxis dataKey="label" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} interval={0} />
        <YAxis domain={[ticks[0]!, ticks[ticks.length - 1]!]} ticks={ticks} tickFormatter={tickFormat} tick={AXIS_TICK} axisLine={false} tickLine={false} width={64} />
        <Tooltip
          cursor={{ stroke: 'var(--muted)', strokeWidth: 1 }}
          content={(p) => {
            const d = activeDatum<MonthDatum>(p);
            if (!d) return null;
            return (
              <TooltipBox
                title={`${MONTHS_LONG[d.month - 1] ?? ''}`}
                rows={[
                  { name: String(current), color: SERIES.current, value: wholeEuros(d.current) },
                  { name: String(prior), color: SERIES.prior, value: wholeEuros(d.prior) },
                ]}
                footer={`Variation : ${formatSignedPercent(variation(d.prior, d.current).ratio, 1)}`}
              />
            );
          }}
        />
        <Line
          type="linear"
          dataKey="prior"
          name={String(prior)}
          stroke={SERIES.prior}
          strokeWidth={2}
          dot={{ r: 4, fill: SERIES.prior, stroke: 'var(--panel)', strokeWidth: 2 }}
          activeDot={{ r: 5, fill: SERIES.prior, stroke: 'var(--panel)', strokeWidth: 2 }}
          isAnimationActive={false}
        />
        <Line
          type="linear"
          dataKey="current"
          name={String(current)}
          stroke={SERIES.current}
          strokeWidth={2}
          dot={{ r: 4, fill: SERIES.current, stroke: 'var(--panel)', strokeWidth: 2 }}
          activeDot={{ r: 5, fill: SERIES.current, stroke: 'var(--panel)', strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------
// (2) Net self-financing ratio over five years
// ---------------------------------------------------------------------------

interface RatioDatum {
  year: number;
  ratio: number;
  history: boolean;
  mean3: number | null;
}

/** Percent ticks (ratios) on whole percentage points covering the values. */
function percentTicks(values: readonly number[]): number[] {
  const lo = Math.floor(Math.min(0, ...values) * 100);
  const hi = Math.ceil(Math.max(...values) * 100 + 0.5);
  const step = Math.max(1, Math.ceil((hi - lo) / 6));
  const out: number[] = [];
  for (let v = lo; v < hi + step; v += step) out.push(v / 100);
  return out;
}

function HistoryDot(props: { cx?: number; cy?: number; index?: number; payload?: RatioDatum }) {
  const { cx, cy, payload, index } = props;
  if (cx === undefined || cy === undefined || !payload) return <g key={`dot-${index ?? 0}`} />;
  return <circle key={`dot-${index ?? 0}`} cx={cx} cy={cy} r={4} strokeWidth={2} stroke={payload.history ? SERIES.current : 'var(--panel)'} fill={payload.history ? 'var(--panel)' : SERIES.current} />;
}

function NetSelfFinancingChart() {
  const c = useCase();
  const { current } = useYears();
  const { presented } = useRatios();
  const ref = c.params.regulatory.netSelfFinancing;
  const ref3 = ref.referenceRate3YearsPct / 100;
  const refYear = ref.referenceRateYearPct / 100;
  const data = useMemo((): RatioDatum[] => presented.series.map((s) => ({ year: s.year, ratio: s.ratio, history: s.source === 'history', mean3: trailingMean(presented.series, s.year) })), [presented]);
  const ticks = percentTicks([...data.map((d) => d.ratio), ref3, refYear]);
  const mean = trailingMean(presented.series, current);
  const last = data.length - 1;
  return (
    <ChartCard
      id="nsf"
      title="Ratio d’autofinancement net HLM"
      description={
        <>
          Ratios {data[0]?.year} à {current} ; points creux : ratios communiqués par la société (agrégats), points pleins : ratios calculés sur les comptes présentés. Ligne pointillée : taux de référence sur trois
          exercices ({formatRatePct(ref.referenceRate3YearsPct)}, en moyenne des ratios) ; taux de référence de l’exercice : {formatRatePct(ref.referenceRateYearPct)}.
        </>
      }
      summary={
        mean !== null && (
          <>
            Moyenne {current - 2}-{current} : <span className="num text-ink">{formatPercent(mean, 1)}</span> (référence {formatRatePct(ref.referenceRate3YearsPct)})
          </>
        )
      }
      table={
        <DataTableView
          caption="Ratio d’autofinancement net HLM et moyenne sur trois exercices"
          head={['Exercice', 'Ratio', 'Moyenne sur trois exercices', 'Source']}
          rows={data.map((d) => [
            String(d.year),
            formatPercent(d.ratio, 1),
            d.mean3 === null ? '—' : formatPercent(d.mean3, 1),
            <span key="s" className="font-sans">
              {d.history ? 'Communiqué (agrégat)' : 'Calculé'}
            </span>,
          ])}
        />
      }
    >
      <LineChart
        responsive
        title={`Ratio d’autofinancement net HLM ${data[0]?.year ?? ''} à ${current}`}
        desc={KEYBOARD_HINT}
        style={{ width: '100%', height: 240 }}
        data={data}
        margin={{ top: 20, right: 40, bottom: 0, left: 4 }}
      >
        <CartesianGrid vertical={false} stroke={GRID_STROKE} />
        <XAxis dataKey="year" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} padding={{ left: 16, right: 16 }} />
        <YAxis domain={[ticks[0]!, ticks[ticks.length - 1]!]} ticks={ticks} tickFormatter={axisPercent} tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} />
        <ReferenceLine
          y={ref3}
          stroke="var(--ink)"
          strokeWidth={1}
          strokeDasharray="4 4"
          ifOverflow="extendDomain"
          label={{ value: `Référence trois exercices : ${formatRatePct(ref.referenceRate3YearsPct)}`, position: 'insideTopLeft', fill: 'var(--muted)', fontSize: 11 }}
        />
        {refYear !== ref3 && (
          <ReferenceLine
            y={refYear}
            stroke="var(--muted)"
            strokeWidth={1}
            strokeDasharray="2 4"
            ifOverflow="extendDomain"
            label={{ value: `Référence de l’exercice : ${formatRatePct(ref.referenceRateYearPct)}`, position: 'insideBottomLeft', fill: 'var(--muted)', fontSize: 11 }}
          />
        )}
        <Tooltip
          cursor={{ stroke: 'var(--muted)', strokeWidth: 1 }}
          content={(p) => {
            const d = activeDatum<RatioDatum>(p);
            if (!d) return null;
            return (
              <TooltipBox
                title={`Exercice ${d.year}`}
                rows={[{ name: d.history ? 'communiqué' : 'calculé', color: SERIES.current, value: formatPercent(d.ratio, 1) }]}
                footer={d.mean3 === null ? undefined : `Moyenne sur trois exercices : ${formatPercent(d.mean3, 1)}`}
              />
            );
          }}
        />
        <Line
          type="linear"
          dataKey="ratio"
          name="Ratio d’autofinancement net"
          stroke={SERIES.current}
          strokeWidth={2}
          dot={HistoryDot}
          activeDot={{ r: 5, fill: SERIES.current, stroke: 'var(--panel)', strokeWidth: 2 }}
          isAnimationActive={false}
        >
          <LabelList position="top" offset={10} fill="var(--ink)" fontSize={11} valueAccessor={(e, i) => (i === last ? formatPercent((e.payload as RatioDatum).ratio, 1) : '')} />
        </Line>
      </LineChart>
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------
// (3) Financial charges and Livret A (small multiples)
// ---------------------------------------------------------------------------

interface PairDatum {
  year: string;
  key: 'prior' | 'current';
  value: number;
}

function PairChart({ title, data, format, label }: { title: string; data: PairDatum[]; format: (v: number) => string; label: string }) {
  const max = Math.max(0, ...data.map((d) => d.value));
  return (
    <div className="min-w-0">
      <p className="mb-1 text-xs font-medium">{title}</p>
      <BarChart responsive title={title} desc={KEYBOARD_HINT} style={{ width: '100%', height: 190 }} data={data} margin={{ top: 22, right: 8, bottom: 0, left: 8 }} barCategoryGap="30%">
        <CartesianGrid vertical={false} horizontal={false} />
        <XAxis dataKey="year" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} />
        <YAxis hide domain={[0, max * 1.12 || 1]} />
        <Tooltip
          cursor={{ fill: 'var(--sunken)' }}
          content={(p) => {
            const d = activeDatum<PairDatum>(p);
            if (!d) return null;
            return <TooltipBox title={`${label} ${d.year}`} rows={[{ name: d.year, color: SERIES[d.key], value: format(d.value) }]} />;
          }}
        />
        <Bar dataKey="value" name={title} barSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.key} fill={SERIES[d.key]} />
          ))}
          <LabelList position="top" fill="var(--ink)" fontSize={11} valueAccessor={(e) => format((e.payload as PairDatum).value)} />
        </Bar>
      </BarChart>
    </div>
  );
}

function FinancialChargesChart() {
  const { current, prior } = useYears();
  const { presented: p } = useRatios();
  const la = useLivretA();
  const fcCur = p.current.figures.financialCharges;
  const fcPri = p.prior.figures.financialCharges;
  const laCur = la.current.averagePct;
  const laPri = la.prior.averagePct;
  const charges: PairDatum[] = [
    { year: String(prior), key: 'prior', value: fcPri },
    { year: String(current), key: 'current', value: fcCur },
  ];
  const rates: PairDatum[] = [
    { year: String(prior), key: 'prior', value: (laPri ?? 0) / 100 },
    { year: String(current), key: 'current', value: (laCur ?? 0) / 100 },
  ];
  const rateChange = laCur !== null && laPri !== null ? `${formatPoints((laCur - laPri) / 100, 2)} (${formatSignedPercent(variation(laPri, laCur).ratio, 1)})` : '—';
  return (
    <ChartCard
      id="interest"
      title="Frais financiers et taux moyen du Livret A"
      description="Deux graphiques côte à côte, chacun sur sa propre échelle : frais financiers des comptes présentés et taux moyen du Livret A de l’exercice (moyenne des taux en vigueur pondérée par le nombre de jours)."
      legend={<Legend items={yearLegend(prior, current, 'rect')} />}
      summary={
        <>
          Frais financiers {formatSignedPercent(variation(fcPri, fcCur).ratio, 1)} ; Livret A {rateChange}
        </>
      }
      table={
        <DataTableView
          caption={`Frais financiers et taux moyen du Livret A, ${prior} et ${current}`}
          head={['Indicateur', String(current), String(prior), 'Évolution']}
          rows={[
            ['Frais financiers', <Amount key="c" cents={fcCur} />, <Amount key="p" cents={fcPri} />, formatSignedPercent(variation(fcPri, fcCur).ratio, 1)],
            ['Taux moyen du Livret A', laCur === null ? '—' : formatPercent(laCur / 100, 2), laPri === null ? '—' : formatPercent(laPri / 100, 2), rateChange],
          ]}
        />
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <PairChart title="Frais financiers" label="Frais financiers" data={charges} format={(v) => axisEuro(v)} />
        <PairChart title="Taux moyen du Livret A" label="Livret A" data={rates} format={(v) => formatPercent(v, 2)} />
      </div>
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------
// (4) Structure of the charges
// ---------------------------------------------------------------------------

interface ChargeDatum {
  id: string;
  label: string;
  current: number;
  prior: number;
  shareCurrent: number | null;
  sharePrior: number | null;
}

/** Category label on one line (truncated; the full label is the SVG title, the tooltip and the table). */
function CategoryTick({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fill="var(--muted)" fontSize={11}>
      <title>{label}</title>
      {shorten(label, 54)}
    </text>
  );
}

function ChargeStructureChart() {
  const c = useCase();
  const { current, prior } = useYears();
  const data = useMemo(
    (): ChargeDatum[] =>
      chargeLines(c.params.statements, c.statements.lines)
        .filter((r) => r.current !== 0 || r.prior !== 0)
        .sort((a, b) => b.current - a.current),
    [c],
  );
  const xTicks = useMemo(() => {
    const values = data.flatMap((r) => [r.current, r.prior]);
    return niceTicks(Math.min(0, ...values), Math.max(0, ...values), 4);
  }, [data]);
  const xFormat = useMemo(() => euroTickFormat(xTicks), [xTicks]);
  const totalCur = data.reduce((s, r) => s + r.current, 0);
  const totalPri = data.reduce((s, r) => s + r.prior, 0);
  const share = (v: number | null) => (v === null ? '—' : formatPercent(v, 1));
  return (
    <ChartCard
      id="charges"
      className="xl:col-span-2"
      title="Structure des charges"
      description="Lignes de charges du compte de résultat présenté (exploitation, financières et exceptionnelles), classées par montant décroissant de l’exercice ; part de chaque ligne dans le total des charges dans le tableau de données."
      legend={<Legend items={yearLegend(prior, current, 'rect')} />}
      summary={
        <>
          Total des charges {current} : <span className="num text-ink">{wholeEuros(totalCur)}</span> ({formatSignedPercent(variation(totalPri, totalCur).ratio, 1)})
        </>
      }
      table={
        <DataTableView
          caption={`Structure des charges du compte de résultat, ${prior} et ${current}`}
          head={['Rubrique', String(current), 'Part', String(prior), 'Part', 'Variation (€)', 'Variation (%)']}
          rows={data.map((r) => [
            r.label,
            <Signed key="c" cents={r.current} decimals={0} />,
            share(r.shareCurrent),
            <Signed key="p" cents={r.prior} decimals={0} />,
            share(r.sharePrior),
            <Signed key="v" cents={r.current - r.prior} decimals={0} />,
            formatSignedPercent(variation(r.prior, r.current).ratio, 1),
          ])}
          foot={[
            'Total des charges',
            <Signed key="c" cents={totalCur} decimals={0} strong />,
            share(totalCur === 0 ? null : 1),
            <Signed key="p" cents={totalPri} decimals={0} strong />,
            share(totalPri === 0 ? null : 1),
            <Signed key="v" cents={totalCur - totalPri} decimals={0} strong />,
            formatSignedPercent(variation(totalPri, totalCur).ratio, 1),
          ]}
        />
      }
    >
      <BarChart
        responsive
        title={`Structure des charges ${prior} et ${current}`}
        desc={KEYBOARD_HINT}
        layout="vertical"
        style={{ width: '100%', height: 36 + data.length * 30 }}
        data={data}
        margin={{ top: 4, right: 16, bottom: 0, left: 4 }}
        barGap={2}
        barCategoryGap={6}
      >
        <CartesianGrid horizontal={false} stroke={GRID_STROKE} />
        <XAxis type="number" domain={[xTicks[0]!, xTicks[xTicks.length - 1]!]} ticks={xTicks} tickFormatter={xFormat} tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} />
        <YAxis
          type="category"
          dataKey="label"
          width={304}
          tick={(t: { x: number | string; y: number | string; payload: { value?: unknown } }) => <CategoryTick x={Number(t.x)} y={Number(t.y)} label={String(t.payload.value ?? '')} />}
          axisLine={false}
          tickLine={false}
          interval={0}
        />
        <Tooltip
          cursor={{ fill: 'var(--sunken)' }}
          content={(p) => {
            const d = activeDatum<ChargeDatum>(p);
            if (!d) return null;
            return (
              <TooltipBox
                title={d.label}
                rows={[
                  { name: String(current), color: SERIES.current, value: wholeEuros(d.current), note: share(d.shareCurrent) },
                  { name: String(prior), color: SERIES.prior, value: wholeEuros(d.prior), note: share(d.sharePrior) },
                ]}
                footer={`Variation : ${formatSignedPercent(variation(d.prior, d.current).ratio, 1)}`}
              />
            );
          }}
        />
        <Bar dataKey="prior" name={String(prior)} fill={SERIES.prior} barSize={10} radius={[0, 4, 4, 0]} isAnimationActive={false} />
        <Bar dataKey="current" name={String(current)} fill={SERIES.current} barSize={10} radius={[0, 4, 4, 0]} isAnimationActive={false} />
      </BarChart>
    </ChartCard>
  );
}

export function Charts() {
  return (
    <div className="grid items-start gap-3 xl:grid-cols-2">
      <MonthlyRentsChart />
      <NetSelfFinancingChart />
      <FinancialChargesChart />
      <ChargeStructureChart />
    </div>
  );
}
