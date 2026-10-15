/**
 * Balance N / N-1 (route '/balance'): every account with its balance at the
 * two closing dates, the movements of the year and the variations; filters,
 * totals of the accounts shown, check that the full balance is balanced, CSV
 * export. A row (click or Enter) opens the general ledger of the account.
 */
import { useDeferredValue, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router';
import { closingBalances } from '../../../engine/balance';
import { toCsv } from '../../../engine/csv';
import { formatDateFr } from '../../../engine/dates';
import { formatAmount, formatPercent } from '../../../engine/format';
import { normalize } from '../../../game/fec-query';
import { balanceCheck, balanceTotals, filterBalance, parseDecimal, variation, type BalanceFilter, type Variation } from '../../../game/ledger';
import type { BalanceRow } from '../../app/case';
import { useCase } from '../../app/context';
import { useDesigner } from '../../app/hooks';
import { DataTable, type Column } from '../../components/DataTable';
import { download } from '../../components/download';
import { Badge, Button, Checkbox, cx, Kbd, PageHeader, Select } from '../../components/ui';
import { useBalanceView } from './balanceView';
import { ACCOUNT_CLASSES, CSV_BOM, csvAmount, plural } from './format';
import { useFillHeight, useSlashFocus } from './hooks';
import { AlignedRow, Field, Signed } from './tableParts';

interface Row extends BalanceRow {
  v: Variation;
  /** Designer mode: presented − clean balance at the two closing dates. */
  delta: number;
  deltaPrior: number;
}

/** Relative variation, '—' without a prior balance. */
function Ratio({ v }: { v: Variation }) {
  if (v.ratio === null) return <span className="num text-muted">—</span>;
  const text = formatPercent(Math.abs(v.ratio), 1);
  return <span className="num">{v.ratio < 0 ? `−${text}` : text}</span>;
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

/** Valid number typed in a filter input, or null; `invalid` when the text cannot be read. */
function useNumberInput(raw: string): { value: number | null; invalid: boolean } {
  return useMemo(() => {
    const v = parseDecimal(raw);
    return v === null ? { value: null, invalid: false } : Number.isNaN(v) ? { value: null, invalid: true } : { value: Math.abs(v), invalid: false };
  }, [raw]);
}

export function BalanceScreen() {
  const c = useCase();
  const designer = useDesigner();
  const navigate = useNavigate();
  const view = useBalanceView();
  const { current, prior } = c.params.scenario.years;
  // dates of the balances shown: 31/12, or the interim cutoff (extraction) and the same date one year earlier
  const currentEnd = formatDateFr(c.view.cutoff);
  const priorEnd = formatDateFr(c.view.priorCutoff);

  // Designer mode only: balances of the clean world, to show what the anomalies changed.
  const clean = useMemo(() => (designer ? { current: closingBalances(c.clean.ledgers.current), prior: closingBalances(c.clean.ledgers.prior) } : null), [c, designer]);

  const rows = useMemo((): Row[] => {
    const base = c.balanceRows();
    const out: Row[] = base.map((r) => ({
      ...r,
      v: variation(r.prior, r.closing),
      delta: clean ? r.closing - (clean.current.get(r.account) ?? 0) : 0,
      deltaPrior: clean ? r.prior - (clean.prior.get(r.account) ?? 0) : 0,
    }));
    if (clean) {
      // Accounts of the clean world that the anomalies emptied completely.
      const known = new Set(base.map((r) => r.account));
      for (const account of new Set([...clean.current.keys(), ...clean.prior.keys()])) {
        if (known.has(account)) continue;
        const cc = clean.current.get(account) ?? 0;
        const cp = clean.prior.get(account) ?? 0;
        if (cc === 0 && cp === 0) continue;
        out.push({ account, label: c.accountLabel(account), prior: 0, opening: 0, debit: 0, credit: 0, closing: 0, v: variation(0, 0), delta: -cc, deltaPrior: -cp });
      }
      out.sort((a, b) => (a.account < b.account ? -1 : a.account > b.account ? 1 : 0));
    }
    return out;
  }, [c, clean]);

  const check = useMemo(() => balanceCheck(rows), [rows]);

  const text = useDeferredValue(view.text);
  const pending = text !== view.text;
  const minVariation = useNumberInput(view.minVariation);
  const minRatio = useNumberInput(view.minRatio);
  const filter = useMemo(
    (): BalanceFilter => ({
      text,
      accountClass: view.accountClass,
      minVariation: minVariation.value === null ? null : Math.round(minVariation.value * 100),
      minRatio: minRatio.value === null ? null : minRatio.value / 100,
      hideSettled: view.hideSettled,
    }),
    [text, view.accountClass, minVariation.value, minRatio.value, view.hideSettled],
  );
  const changedOnly = designer && view.changedOnly;
  const shown = useMemo(() => {
    const r = filterBalance(rows, filter);
    return changedOnly ? r.filter((x) => x.delta !== 0 || x.deltaPrior !== 0) : r;
  }, [rows, filter, changedOnly]);
  const totals = useMemo(() => balanceTotals(shown), [shown]);
  const filtered = view.text.trim() !== '' || view.accountClass !== '' || view.minVariation.trim() !== '' || view.minRatio.trim() !== '' || view.hideSettled || changedOnly;

  const decimals = view.cents ? 2 : 0;
  const columns = useMemo((): Column<Row>[] => {
    const w = view.cents ? '8.5rem' : '7rem';
    const amount = (id: string, header: ReturnType<typeof Head>, get: (r: Row) => number): Column<Row> => ({ id, header, width: w, align: 'right', cell: (r) => <Signed cents={get(r)} decimals={decimals} />, sortValue: get });
    const cols: (Column<Row> | false)[] = [
      { id: 'account', header: 'Compte', width: '4.75rem', cell: (r) => <span className="font-mono">{r.account}</span>, sortValue: (r) => r.account },
      { id: 'label', header: 'Libellé', width: 'minmax(10rem,1fr)', cell: (r) => r.label, title: (r) => `${r.account} – ${r.label}`, sortValue: (r) => normalize(r.label) },
      amount('prior', <Head top="Solde" bottom={priorEnd} />, (r) => r.prior),
      view.showOpening && amount('opening', <Head top="À-nouveaux" bottom={String(current)} />, (r) => r.opening),
      amount('debit', <Head top="Débit" bottom={String(current)} />, (r) => r.debit),
      amount('credit', <Head top="Crédit" bottom={String(current)} />, (r) => r.credit),
      amount('closing', <Head top="Solde" bottom={currentEnd} />, (r) => r.closing),
      amount('variation', <Head top="Variation" bottom="(€)" />, (r) => r.v.amount),
      {
        id: 'ratio',
        header: <Head top="Variation" bottom="(%)" />,
        width: '5.5rem',
        align: 'right',
        cell: (r) => <Ratio v={r.v} />,
        sortValue: (r) => r.v.ratio ?? (r.v.amount === 0 ? 0 : r.v.amount > 0 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY),
      },
      designer && {
        id: 'delta',
        header: <Head top="Écart / propre" bottom={`(${current})`} />,
        width: w,
        align: 'right',
        cell: (r) => (r.delta !== 0 || r.deltaPrior !== 0 ? <span className="text-warn"><Signed cents={r.delta} decimals={decimals} /></span> : <span className="text-muted">·</span>),
        title: (r) => (r.delta !== 0 || r.deltaPrior !== 0 ? `Comptes présentés − comptes propres : ${formatAmount(r.delta)} au ${currentEnd}, ${formatAmount(r.deltaPrior)} au ${priorEnd}` : ''),
        sortValue: (r) => Math.abs(r.delta) + Math.abs(r.deltaPrior),
      },
    ];
    return cols.filter((x): x is Column<Row> => x !== false);
  }, [view.cents, view.showOpening, decimals, designer, current, currentEnd, priorEnd]);

  const exportCsv = () => {
    const header = ['Compte', 'Libellé', `Solde ${priorEnd}`, ...(view.showOpening ? [`À-nouveaux ${current}`] : []), `Débit ${current}`, `Crédit ${current}`, `Solde ${currentEnd}`, 'Variation', 'Variation (%)'];
    const lines = shown.map((r) => [
      r.account,
      r.label,
      csvAmount(r.prior),
      ...(view.showOpening ? [csvAmount(r.opening)] : []),
      csvAmount(r.debit),
      csvAmount(r.credit),
      csvAmount(r.closing),
      csvAmount(r.v.amount),
      // Percentage with two decimals, written with the FEC amount format (decimal comma).
      r.v.ratio === null ? '' : csvAmount(Math.round(r.v.ratio * 10000)),
    ]);
    download(`balance-${current}-${prior}.csv`, '﻿' + toCsv([header, ...lines]), 'text/csv;charset=utf-8');
  };

  const searchRef = useRef<HTMLInputElement>(null);
  useSlashFocus(searchRef);
  const fillRef = useRef<HTMLDivElement>(null);
  const height = useFillHeight(fillRef, 64);

  return (
    <>
      <PageHeader
        title="Balance N / N-1"
        description={
          <>
            Balance générale au {currentEnd} et soldes au {priorEnd}, en euros : soldes débiteurs positifs, soldes créditeurs précédés du signe moins. Les mouvements de l’exercice excluent les à-nouveaux. Cliquez sur un compte (ou <Kbd>Entrée</Kbd>) pour ouvrir son grand livre.
          </>
        }
        actions={
          <Button onClick={exportCsv} disabled={!shown.length} title="Télécharger les comptes affichés (CSV, séparateur point-virgule)">
            Exporter (CSV)
          </Button>
        }
      />

      <section aria-label="Filtres de la balance" className="mb-3 space-y-2 rounded-lg border border-line bg-panel px-3 py-2.5">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
          <Field
            id="bal-search"
            label={
              <span className="flex items-center justify-between gap-2">
                Compte ou libellé <Kbd>/</Kbd>
              </span>
            }
            className="w-56"
          >
            <input
              id="bal-search"
              ref={searchRef}
              type="search"
              value={view.text}
              onChange={(e) => view.update({ text: e.target.value })}
              placeholder="ex. 411 ou locataires"
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-md border border-line bg-panel px-2 py-1 text-sm placeholder:text-muted"
            />
          </Field>
          <Field id="bal-class" label="Classe" className="w-48">
            <Select id="bal-class" value={view.accountClass} onChange={(e) => view.update({ accountClass: e.target.value })} className="w-full">
              <option value="">Toutes les classes</option>
              {ACCOUNT_CLASSES.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.id} – {k.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="bal-min-var" label="Variation minimale (€)" className="w-40">
            <input
              id="bal-min-var"
              inputMode="decimal"
              value={view.minVariation}
              onChange={(e) => view.update({ minVariation: e.target.value })}
              placeholder="valeur absolue"
              aria-invalid={minVariation.invalid || undefined}
              aria-describedby={minVariation.invalid ? 'bal-min-var-error' : undefined}
              title="Écart entre les deux soldes, en valeur absolue"
              className={cx('w-full rounded-md border bg-panel px-2 py-1 text-right font-mono text-sm placeholder:font-sans placeholder:text-muted', minVariation.invalid ? 'border-ko' : 'border-line')}
            />
          </Field>
          <Field id="bal-min-ratio" label="Variation minimale (%)" className="w-40">
            <input
              id="bal-min-ratio"
              inputMode="decimal"
              value={view.minRatio}
              onChange={(e) => view.update({ minRatio: e.target.value })}
              placeholder="valeur absolue"
              aria-invalid={minRatio.invalid || undefined}
              aria-describedby={minRatio.invalid ? 'bal-min-ratio-error' : undefined}
              title={`Variation rapportée à la valeur absolue du solde au ${priorEnd} ; un compte sans solde à cette date est retenu dès qu’il varie`}
              className={cx('w-full rounded-md border bg-panel px-2 py-1 text-right font-mono text-sm placeholder:font-sans placeholder:text-muted', minRatio.invalid ? 'border-ko' : 'border-line')}
            />
          </Field>
          {filtered && (
            <Button variant="ghost" className="mb-0.5 ml-auto" onClick={view.resetFilters}>
              Réinitialiser les filtres
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <Checkbox id="bal-hide-settled" label="Masquer les comptes soldés sur les deux exercices" checked={view.hideSettled} onChange={(v) => view.update({ hideSettled: v })} />
          <Checkbox id="bal-cents" label="Afficher les centimes" checked={view.cents} onChange={(v) => view.update({ cents: v })} />
          <Checkbox id="bal-opening" label="Afficher les à-nouveaux" checked={view.showOpening} onChange={(v) => view.update({ showOpening: v })} />
          {designer && <Checkbox id="bal-changed" label={<span className="text-warn">Comptes modifiés par les anomalies (concepteur)</span>} checked={view.changedOnly} onChange={(v) => view.update({ changedOnly: v })} />}
        </div>
        {(minVariation.invalid || minRatio.invalid) && (
          <p role="alert" className="w-full text-xs text-ko">
            <span id="bal-min-var-error">{minVariation.invalid ? 'Variation minimale en euros illisible : saisissez un nombre (virgule décimale acceptée). ' : ''}</span>
            <span id="bal-min-ratio-error">{minRatio.invalid ? 'Variation minimale en pourcentage illisible : saisissez un nombre.' : ''}</span>
          </p>
        )}
      </section>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted">
        <p aria-live="polite" className={cx(pending && 'opacity-60')}>
          {plural(shown.length, 'compte affiché', 'comptes affichés')}
          {shown.length !== rows.length ? ` sur ${rows.length}` : ''}
          {pending ? ' – filtrage…' : ''}
        </p>
        <p className="flex flex-wrap items-center gap-1.5">
          <span>Contrôle de la balance complète :</span>
          <CheckBadge sum={check.current} date={currentEnd} />
          <CheckBadge sum={check.prior} date={priorEnd} />
        </p>
      </div>

      <div ref={fillRef} className="overflow-hidden rounded-lg border border-line bg-panel">
        <DataTable
          rows={shown}
          columns={columns}
          rowKey={(r) => r.account}
          ariaLabel={`Balance générale au ${currentEnd} et au ${priorEnd}`}
          height={height ? `${Math.max(160, Math.min(height, 50 + shown.length * 30))}px` : 'calc(100vh - 20rem)'}
          onRowClick={(r) => navigate(`/grand-livre?compte=${encodeURIComponent(r.account)}`)}
          rowClassName={designer ? (r) => (r.delta !== 0 || r.deltaPrior !== 0 ? 'bg-warn/10' : '') : undefined}
          footer={
            shown.length ? (
              <AlignedRow
                columns={columns}
                lead={<span className="text-xs font-semibold">{shown.length > 1 ? `Total des ${plural(shown.length, 'compte affiché', 'comptes affichés')}` : 'Total du compte affiché'}</span>}
                leadSpan={2}
                className="text-sm"
                cells={{
                  prior: <Signed cents={totals.prior} decimals={decimals} strong />,
                  opening: <Signed cents={totals.opening} decimals={decimals} strong />,
                  debit: <Signed cents={totals.debit} decimals={decimals} strong />,
                  credit: <Signed cents={totals.credit} decimals={decimals} strong />,
                  closing: <Signed cents={totals.closing} decimals={decimals} strong />,
                  variation: <Signed cents={totals.closing - totals.prior} decimals={decimals} strong />,
                }}
              />
            ) : (
              <p className="py-1 text-center text-sm text-muted">
                Aucun compte ne correspond aux filtres.{' '}
                <button type="button" onClick={view.resetFilters} className="text-accent underline-offset-2 hover:underline">
                  Réinitialiser les filtres
                </button>
              </p>
            )
          }
        />
      </div>
    </>
  );
}

/** Sum of the signed balances of the full balance at one date: zero when it is balanced. */
function CheckBadge({ sum, date }: { sum: number; date: string }) {
  return sum === 0 ? (
    <Badge tone="ok" title={`Somme des soldes débiteurs et créditeurs au ${date} : ${formatAmount(sum)}`}>
      Balance équilibrée au {date}
    </Badge>
  ) : (
    <Badge tone="ko" title="La somme des soldes débiteurs et créditeurs devrait être nulle">
      Balance déséquilibrée au {date} : écart de {formatAmount(sum)}
    </Badge>
  );
}
