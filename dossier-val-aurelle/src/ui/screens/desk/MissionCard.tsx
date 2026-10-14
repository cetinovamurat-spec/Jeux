/** Desk: engagement card (entity, audited year, key dates, key figures of the client's draft accounts). */
import { useMemo, type ReactNode } from 'react';
import { formatDateFr, type IsoDate } from '../../../engine/dates';
import { formatEuro, formatMEuro, formatPercent } from '../../../engine/format';
import type { Cents } from '../../../engine/money';
import { useCase } from '../../app/context';
import { useGame } from '../../app/store';
import { Badge, Card, cx } from '../../components/ui';

interface KeyDate {
  label: string;
  from: IsoDate;
  to?: IsoDate;
}

interface FigureRow {
  label: string;
  current: Cents;
  prior: Cents;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

function SectionTitle({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h3 id={id} className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
      {children}
    </h3>
  );
}

function variation(current: Cents, prior: Cents): string {
  if (prior === 0) return '–';
  const r = (current - prior) / Math.abs(prior);
  return `${r > 0 ? '+' : ''}${formatPercent(r, 1)}`;
}

export function MissionCard() {
  const c = useCase();
  const date = useGame((s) => s.game.clock.date);
  const { entity, years } = c.params.scenario;
  const cal = c.params.documents.calendar;
  const reporting = c.params.game.calendar.find((p) => p.id === 'reporting');

  const keyDates = useMemo<KeyDate[]>(() => {
    const out: KeyDate[] = [];
    const push = (label: string, from: IsoDate | undefined, to?: IsoDate) => {
      if (from) out.push({ label, from, ...(to && to !== from ? { to } : {}) });
    };
    push('Intérim', cal['interimStart'], cal['interimEnd']);
    push('Envoi des demandes de confirmation', cal['confirmationsSent']);
    push('Final', cal['finalStart'], cal['finalEnd']);
    push('Arrêté des comptes par le conseil d’administration', cal['boardClosing']);
    push('Signature du rapport, au plus tard', reporting?.to);
    push('Assemblée générale', cal['generalMeeting']);
    return out;
  }, [cal, reporting]);

  const rows = useMemo<FigureRow[]>(() => {
    const f = c.figures().y2025;
    const lines = c.statements.lines;
    return [
      { label: 'Résultat net', current: f.netResult, prior: lines['CR_RESULTAT']?.prior ?? 0 },
      { label: 'Total du bilan', current: lines['ACTIF_TOTAL']?.current ?? 0, prior: lines['ACTIF_TOTAL']?.prior ?? 0 },
      { label: 'Loyers (nets de la RLS)', current: f.rents, prior: lines['CR_LOYERS']?.prior ?? 0 },
    ];
  }, [c]);

  const yearStart = `${years.current}-01-01`;
  const yearEnd = `${years.current}-12-31`;

  return (
    <Card title="Mission" actions={<Badge tone="accent">Exercice {years.current}</Badge>} className="@container">
      <div className="grid gap-4 p-3 @2xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <section aria-labelledby="desk-entity">
          <SectionTitle id="desk-entity">Entité auditée</SectionTitle>
          <dl className="grid gap-x-4 gap-y-2 @md:grid-cols-2">
            <Field label="Dénomination">
              <span className="font-semibold">{entity.name}</span>
            </Field>
            <Field label="Capital social">
              <span className="font-mono">{formatEuro(Math.round(entity.capitalEuros * 100), 0)}</span>
            </Field>
            <div className="@md:col-span-2">
              <Field label="Forme juridique">{entity.legalForm}</Field>
            </div>
            <Field label="Siège social">{entity.registeredOffice}</Field>
            <Field label="Actionnaire de référence">{entity.referenceShareholder}</Field>
            <Field label="Groupe d’appartenance">{entity.group}</Field>
            <Field label="Exercice audité">
              du {formatDateFr(yearStart)} au {formatDateFr(yearEnd)}
            </Field>
          </dl>
        </section>
        <section aria-labelledby="desk-dates">
          <SectionTitle id="desk-dates">Dates clés</SectionTitle>
          <dl className="divide-y divide-line text-sm">
            <div className="flex items-baseline justify-between gap-3 py-1">
              <dt>Clôture de l’exercice</dt>
              <dd className="shrink-0 font-mono text-xs">{formatDateFr(yearEnd)}</dd>
            </div>
            {keyDates.map((d) => {
              const past = (d.to ?? d.from) < date;
              return (
                <div key={d.label} className={cx('flex items-baseline justify-between gap-3 py-1', past && 'text-muted')}>
                  <dt>{d.label}</dt>
                  <dd className="shrink-0 text-right font-mono text-xs">
                    {d.to ? (
                      <>
                        {formatDateFr(d.from)} – {formatDateFr(d.to)}
                      </>
                    ) : (
                      formatDateFr(d.from)
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>
      </div>
      <section aria-labelledby="desk-figures" className="border-t border-line px-3 pb-3 pt-2.5">
        <SectionTitle id="desk-figures">Chiffres clés – projet de comptes du client</SectionTitle>
        <table className="w-full text-sm">
          <caption className="sr-only">Chiffres clés du projet de comptes {years.current} présenté par le client, avant audit</caption>
          <thead>
            <tr className="border-b border-line text-xs text-muted">
              <th scope="col" className="py-1 pr-2 text-left font-medium">
                Agrégat
              </th>
              <th scope="col" className="px-2 py-1 text-right font-medium">
                {years.current}
              </th>
              <th scope="col" className="px-2 py-1 text-right font-medium">
                {years.prior}
              </th>
              <th scope="col" className="py-1 pl-2 text-right font-medium">
                Variation
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-b border-line last:border-b-0">
                <th scope="row" className="py-1.5 pr-2 text-left font-normal">
                  {r.label}
                </th>
                <td className="num px-2 py-1.5 font-semibold" title={formatEuro(r.current)}>
                  {formatMEuro(r.current, 2)}
                </td>
                <td className="num px-2 py-1.5 text-muted" title={formatEuro(r.prior)}>
                  {formatMEuro(r.prior, 2)}
                </td>
                <td className="num py-1.5 pl-2 text-muted">{variation(r.current, r.prior)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-muted">
          Projet de comptes remis par le client, non audité. La colonne {years.prior} reprend le comparatif tel que présenté par le client. Le détail figure dans les écrans « États financiers » et « Balance ».
        </p>
      </section>
    </Card>
  );
}
