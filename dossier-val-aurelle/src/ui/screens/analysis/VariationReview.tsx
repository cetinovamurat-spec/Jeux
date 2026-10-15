/**
 * Variation review of the presented statements: every line of the income
 * statement (or of the balance sheet) with the two years, the variation in
 * euros and percent, and a generic flag when the variation exceeds both
 * thresholds typed by the player. CSV export of the table shown.
 */
import { useMemo, useRef } from 'react';
import { toCsv } from '../../../engine/csv';
import { formatDateFr } from '../../../engine/dates';
import { formatAmount } from '../../../engine/format';
import type { StatementId } from '../../../engine/types';
import { readThreshold, statementVariations, toThresholds, type StatementVariationRow, type Variation } from '../../../game/analysis';
import { useCase } from '../../app/context';
import { useDesigner } from '../../app/hooks';
import { DataTable, type Column } from '../../components/DataTable';
import { download } from '../../components/download';
import { Badge, Button, Checkbox, cx } from '../../components/ui';
import { CSV_BOM, csvAmount, plural } from '../balance/format';
import { useFillHeight } from '../balance/hooks';
import { Field, Signed } from '../balance/tableParts';
import { useAnalysisView } from './analysisView';
import { formatSignedPercent } from './labels';

export type ReviewKind = 'income' | 'balance';

const STATEMENTS: Record<ReviewKind, readonly StatementId[]> = { income: ['income'], balance: ['assets', 'liabilities'] };

interface Row extends StatementVariationRow {
  /** Position in the statement (sorting the label column restores it). */
  index: number;
  /** Designer mode: presented − clean (current year), presented comparative − certified (prior year). */
  delta: number;
  deltaPrior: number;
}

/** Two-line column header (keeps the amount columns narrow). */
function Head({ top, bottom }: { top: string; bottom: string }) {
  return (
    <span className="inline-block leading-tight">
      {top}
      <br />
      {bottom}
    </span>
  );
}

function Ratio({ v }: { v: Variation }) {
  return <span className={cx('num', v.ratio === null && 'text-muted')}>{formatSignedPercent(v.ratio, 1)}</span>;
}

export function ThresholdsBar({ flaggedCount, total, onExport, exportLabel }: { flaggedCount: number; total: number; onExport: () => void; exportLabel: string }) {
  const view = useAnalysisView();
  const pct = useMemo(() => readThreshold(view.pctText), [view.pctText]);
  const euros = useMemo(() => readThreshold(view.eurosText), [view.eurosText]);
  const none = pct.value === null && euros.value === null;
  return (
    <section aria-label="Seuils de la revue des variations" className="mb-3 space-y-2 rounded-lg border border-line bg-panel px-3 py-2.5">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <Field id="an-pct" label="Seuil de variation (%)" className="w-40">
          <input
            id="an-pct"
            inputMode="decimal"
            value={view.pctText}
            onChange={(e) => view.update({ pctText: e.target.value })}
            placeholder="non appliqué"
            aria-invalid={pct.invalid || undefined}
            aria-describedby="an-thresholds-help"
            title="Variation rapportée à la valeur absolue du montant de l’exercice précédent"
            className={cx('w-full rounded-md border bg-panel px-2 py-1 text-right font-mono text-sm placeholder:font-sans placeholder:text-muted', pct.invalid ? 'border-ko' : 'border-line')}
          />
        </Field>
        <Field id="an-eur" label="Seuil de variation (€)" className="w-44">
          <input
            id="an-eur"
            inputMode="decimal"
            value={view.eurosText}
            onChange={(e) => view.update({ eurosText: e.target.value })}
            placeholder="non appliqué"
            aria-invalid={euros.invalid || undefined}
            aria-describedby="an-thresholds-help"
            title="Écart entre les deux exercices, en valeur absolue"
            className={cx('w-full rounded-md border bg-panel px-2 py-1 text-right font-mono text-sm placeholder:font-sans placeholder:text-muted', euros.invalid ? 'border-ko' : 'border-line')}
          />
        </Field>
        <div className="mb-1">
          <Checkbox id="an-flagged" label="Lignes au-delà des seuils uniquement" checked={view.flaggedOnly} onChange={(v) => view.update({ flaggedOnly: v })} />
        </div>
        <div className="mb-0.5 ml-auto flex items-center gap-2">
          <Button variant="ghost" onClick={view.resetThresholds}>
            Seuils par défaut
          </Button>
          <Button onClick={onExport} title="Télécharger le tableau affiché (CSV, séparateur point-virgule)">
            {exportLabel}
          </Button>
        </div>
      </div>
      <p id="an-thresholds-help" className="text-xs text-muted">
        Une ligne est signalée lorsque sa variation dépasse, en valeur absolue, chacun des seuils renseignés ; un seuil vide n’est pas appliqué. Une ligne sans montant l’exercice précédent dépasse tout seuil en
        pourcentage.{' '}
        <span aria-live="polite" className="text-ink">
          {none ? 'Aucun seuil renseigné : aucune ligne n’est signalée.' : `${plural(flaggedCount, 'ligne signalée', 'lignes signalées')} sur ${total}.`}
        </span>
      </p>
      {(pct.invalid || euros.invalid) && (
        <p role="alert" className="text-xs text-ko">
          {pct.invalid ? 'Seuil en pourcentage illisible : saisissez un nombre (virgule décimale acceptée). ' : ''}
          {euros.invalid ? 'Seuil en euros illisible : saisissez un nombre (virgule décimale acceptée).' : ''}
        </p>
      )}
    </section>
  );
}

export function VariationReview({ kind }: { kind: ReviewKind }) {
  const c = useCase();
  const designer = useDesigner();
  const view = useAnalysisView();
  const { current, prior } = c.params.scenario.years;
  const pct = useMemo(() => readThreshold(view.pctText), [view.pctText]);
  const euros = useMemo(() => readThreshold(view.eurosText), [view.eurosText]);
  const thresholds = useMemo(() => toThresholds(pct.value, euros.value), [pct.value, euros.value]);

  const rows = useMemo((): Row[] => {
    const clean = designer ? c.key.cleanFigures.statements.lines : null;
    return statementVariations(c.params.statements, c.statements.lines, STATEMENTS[kind], thresholds).map((r, index) => ({
      ...r,
      index,
      delta: clean ? r.current - (clean[r.id]?.current ?? 0) : 0,
      deltaPrior: clean ? r.prior - (clean[r.id]?.prior ?? 0) : 0,
    }));
  }, [c, kind, thresholds, designer]);
  const flaggedCount = useMemo(() => rows.filter((r) => r.flagged).length, [rows]);
  const shown = useMemo(() => (view.flaggedOnly ? rows.filter((r) => r.flagged) : rows), [rows, view.flaggedOnly]);

  const isIncome = kind === 'income';
  const curHead = isIncome ? { top: 'Exercice', bottom: String(current) } : { top: 'Au', bottom: formatDateFr(`${current}-12-31`) };
  const priHead = isIncome ? { top: 'Exercice', bottom: String(prior) } : { top: 'Au', bottom: formatDateFr(`${prior}-12-31`) };

  const columns = useMemo((): Column<Row>[] => {
    const amount = (id: string, header: { top: string; bottom: string }, get: (r: Row) => number): Column<Row> => ({
      id,
      header: <Head top={header.top} bottom={header.bottom} />,
      width: '6.25rem',
      align: 'right',
      cell: (r) => <Signed cents={get(r)} decimals={0} strong={r.kind !== 'detail'} />,
      sortValue: get,
    });
    const cols: (Column<Row> | false)[] = [
      {
        id: 'label',
        header: 'Rubrique',
        width: 'minmax(11rem,1fr)',
        cell: (r) => (
          <span className={cx(r.kind !== 'detail' && 'font-semibold')} style={{ paddingLeft: `${r.depth * 1}rem` }}>
            {r.label}
          </span>
        ),
        title: (r) => r.label,
        sortValue: (r) => r.index,
      },
      amount('current', curHead, (r) => r.current),
      amount('prior', priHead, (r) => r.prior),
      amount('variation', { top: 'Variation', bottom: '(€)' }, (r) => r.variation.amount),
      {
        id: 'ratio',
        header: <Head top="Variation" bottom="(%)" />,
        width: '4.75rem',
        align: 'right',
        cell: (r) => <Ratio v={r.variation} />,
        sortValue: (r) => r.variation.ratio ?? (r.variation.amount === 0 ? 0 : r.variation.amount > 0 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY),
      },
      {
        id: 'flag',
        header: 'Seuils',
        width: '5.5rem',
        cell: (r) =>
          r.flagged ? (
            <Badge tone="warn" title="Variation supérieure, en valeur absolue, aux seuils renseignés : à expliquer">
              À expliquer
            </Badge>
          ) : null,
        sortValue: (r) => (r.flagged ? 1 : 0),
      },
      designer && {
        id: 'delta',
        header: <Head top="Écart / propre" bottom={`(${current})`} />,
        width: '6.75rem',
        align: 'right',
        cell: (r) =>
          r.delta !== 0 || r.deltaPrior !== 0 ? (
            <span className="text-warn">
              <Signed cents={r.delta} decimals={0} />
            </span>
          ) : (
            <span className="text-muted">·</span>
          ),
        title: (r) => (r.delta !== 0 || r.deltaPrior !== 0 ? `Présenté − propre ${current} : ${formatAmount(r.delta)} ; comparatif présenté − certifié ${prior} : ${formatAmount(r.deltaPrior)}` : ''),
        sortValue: (r) => Math.abs(r.delta) + Math.abs(r.deltaPrior),
      },
    ];
    return cols.filter((x): x is Column<Row> => x !== false);
  }, [designer, current, prior, curHead.top, curHead.bottom, priHead.top, priHead.bottom]);

  const exportCsv = () => {
    const header = ['Rubrique', `${curHead.top} ${curHead.bottom}`, `${priHead.top} ${priHead.bottom}`, 'Variation', 'Variation (%)', 'Au-delà des seuils'];
    const lines = shown.map((r) => [
      r.label,
      csvAmount(r.current),
      csvAmount(r.prior),
      csvAmount(r.variation.amount),
      // Percentage with two decimals, written with the FEC amount format (decimal comma).
      r.variation.ratio === null ? '' : csvAmount(Math.round(r.variation.ratio * 10000)),
      r.flagged ? 'oui' : '',
    ]);
    download(`revue-analytique-${isIncome ? 'compte-de-resultat' : 'bilan'}-${current}-${prior}.csv`, CSV_BOM + toCsv([header, ...lines]), 'text/csv;charset=utf-8');
  };

  const fillRef = useRef<HTMLDivElement>(null);
  const height = useFillHeight(fillRef, 24);
  const natural = 44 + Math.max(1, shown.length) * 30;

  return (
    <>
      <ThresholdsBar flaggedCount={flaggedCount} total={rows.length} onExport={exportCsv} exportLabel="Exporter (CSV)" />
      <p className="mb-2 text-xs text-muted">
        {isIncome ? 'Compte de résultat' : 'Bilan (actif puis passif, montants nets)'} présenté par la société, en euros ; la colonne {prior} est le comparatif tel que présenté dans les comptes {current}. Variation ={' '}
        {current} − {prior}, rapportée à la valeur absolue de {prior}.{designer && <span className="text-warn"> Concepteur : écart avec les comptes propres (survol pour le comparatif certifié).</span>}
      </p>
      <div ref={fillRef} className="overflow-hidden rounded-lg border border-line bg-panel">
        <DataTable
          rows={shown}
          columns={columns}
          rowKey={(r) => r.id}
          ariaLabel={isIncome ? `Revue des variations du compte de résultat ${current} / ${prior}` : `Revue des variations du bilan ${current} / ${prior}`}
          height={`${height ? Math.max(160, Math.min(height, natural)) : Math.min(natural, 600)}px`}
          rowClassName={(r) => cx(r.kind === 'total' && 'bg-sunken', designer && (r.delta !== 0 || r.deltaPrior !== 0) && 'bg-warn/10')}
          footer={
            shown.length ? undefined : (
              <p className="py-1 text-center text-sm text-muted">
                Aucune ligne ne dépasse les seuils.{' '}
                <button type="button" onClick={() => view.update({ flaggedOnly: false })} className="text-accent underline-offset-2 hover:underline">
                  Afficher toutes les lignes
                </button>
              </p>
            )
          }
        />
      </div>
    </>
  );
}
