/**
 * Detail of one entry of the FEC: every line, dates (with the weekday), piece,
 * user, and the debit → credit account pairs with their frequency in the year.
 * In designer mode only: origin of the entry and comparison with the clean world.
 */
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Link } from 'react-router';
import { formatEuro } from '../../../engine/format';
import { entryLinesOf, pairsOf, rarePairsOf, type FecIndex } from '../../../game/fec-query';
import { cycleOfAccount } from '../../../game/planning';
import { useCase } from '../../app/context';
import { Amount } from '../../components/Amount';
import { Badge, Button, cx } from '../../components/ui';
import { NewFindingButton } from '../findings/NewFindingButton';
import { RequestButton } from '../tools/RequestControls';
import { originLabel, type EntryDiagnostic } from './diagnostics';
import { dateWithWeekday, formatFecDate, plural } from './labels';

export interface EntryDetailProps {
  index: FecIndex;
  entryId: string;
  /** Pairs seen in at most this number of entries are flagged as rare. */
  threshold: number;
  roles: ReadonlyMap<string, string>;
  diagnostic?: EntryDiagnostic | undefined;
  designer: boolean;
  onClose: () => void;
}

function Item({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cx('min-w-0', className)}>
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

export function EntryDetail({ index, entryId, threshold, roles, diagnostic, designer, onClose }: EntryDetailProps) {
  const c = useCase();
  const lines = useMemo(() => entryLinesOf(index, entryId), [index, entryId]);
  const pairs = useMemo(() => pairsOf(index, entryId), [index, entryId]);
  const rare = useMemo(() => rarePairsOf(index, entryId, threshold), [index, entryId, threshold]);
  // The detail takes the focus when it opens (keyboard users reach it at once).
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
  }, [entryId]);
  // Escape closes the detail (except inside a dialog such as the command palette).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if ((e.target as HTMLElement | null)?.closest?.('[role="dialog"]')) return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const first = lines[0];
  if (!first) return null;
  const year = Number(index.closingDate.slice(0, 4));
  // accounts of the entry other than cash, largest amounts first (objects proposed to a finding)
  const entryAccounts = [...new Set([...lines].sort((a, b) => b.debitCents + b.creditCents - (a.debitCents + a.creditCents)).map((l) => l.CompteNum).filter((n) => !n.startsWith('5')))].slice(0, 2);
  const mainAccount = entryAccounts[0] ?? first.CompteNum;
  const labels = new Map(lines.map((l) => [l.CompteNum, l.CompteLib]));
  const debit = lines.reduce((t, l) => t + l.debitCents, 0);
  const credit = lines.reduce((t, l) => t + l.creditCents, 0);
  const late = first.validDate > index.closingDate;
  const role = roles.get(first.enteredBy);
  const account = (n: string) => (
    <>
      <span className="font-mono">{n}</span> <span className="text-muted">{labels.get(n) ?? ''}</span>
    </>
  );

  return (
    <section
      aria-labelledby="fec-entry-title"
      className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-line bg-panel"
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        <h2 id="fec-entry-title" className="text-sm font-semibold">
          Écriture <span className="font-mono">{first.EcritureNum}</span> <span className="font-normal text-muted">– journal {first.JournalCode} · {first.JournalLib}</span>
        </h2>
        {designer && diagnostic && (
          <Badge tone="warn" title={`Concepteur – origine : ${diagnostic.origin}`}>
            {diagnostic.change === 'added' ? `Ajoutée (${originLabel(diagnostic.origin)})` : diagnostic.change === 'modified' ? 'Modifiée par rapport au monde propre' : `Origine ${originLabel(diagnostic.origin)}`}
          </Badge>
        )}
        <span className="ml-auto flex flex-wrap items-center gap-1">
          <RequestButton compact family="entry-voucher" object={`${year}:${first.EcritureNum}`} />
          <NewFindingButton
            compact
            seed={{
              cycle: cycleOfAccount(mainAccount, c.params.cycles.cycles),
              objects: entryAccounts.map((id) => ({ kind: 'account', id })),
              evidence: [{ kind: 'fec', year, num: first.EcritureNum }],
              label: `Écriture ${first.EcritureNum} (${year}) – ${first.EcritureLib}`,
            }}
          />
        </span>
        <Button ref={closeRef} variant="ghost" className="px-2 py-0.5 text-xs" onClick={onClose} aria-label="Fermer le détail de l’écriture" title="Fermer (Échap)">
          Fermer ✕
        </Button>
      </header>

      <div className="@container min-h-0 flex-1 overflow-y-auto">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 px-3 py-2 @3xl:grid-cols-4">
          <Item label="Date d’écriture">{dateWithWeekday(first.date)}</Item>
          <Item label="Date de validation">
            {dateWithWeekday(first.validDate)}
            {late && <span className="text-muted"> (après la clôture)</span>}
          </Item>
          <Item label="Pièce">
            {first.PieceRef ? (
              <>
                <span className="font-mono">{first.PieceRef}</span>
                {first.PieceDate && <span className="text-muted"> du {formatFecDate(first.PieceDate)}</span>}
              </>
            ) : (
              <span className="text-muted">Aucune référence de pièce</span>
            )}
          </Item>
          <Item label="Saisie par">
            <span className="font-mono">{first.enteredBy}</span>
            {role && <span className="block truncate text-xs text-muted" title={role}>{role}</span>}
          </Item>
          <Item label="Libellé" className="col-span-2">
            {first.EcritureLib}
          </Item>
          <Item label="Lignes">{plural(lines.length, 'ligne', 'lignes')}</Item>
          <Item label="Total débit / crédit">
            <span className="num">{formatEuro(debit)}</span>
            {debit !== credit && <span className="num text-ko"> / {formatEuro(credit)}</span>}
          </Item>
        </dl>

        <div className="overflow-x-auto border-y border-line">
          <table className="w-full min-w-[40rem] text-xs">
            <caption className="sr-only">Lignes de l’écriture {first.EcritureNum}</caption>
            <thead className="bg-sunken text-muted">
              <tr>
                <th scope="col" className="px-3 py-1 text-left font-semibold">Compte</th>
                <th scope="col" className="px-2 py-1 text-left font-semibold">Auxiliaire</th>
                <th scope="col" className="px-2 py-1 text-left font-semibold">Libellé</th>
                <th scope="col" className="px-2 py-1 text-right font-semibold">Débit</th>
                <th scope="col" className="px-2 py-1 text-right font-semibold">Crédit</th>
                <th scope="col" className="px-3 py-1 text-left font-semibold">Lettrage</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, k) => (
                <tr key={k} className="border-t border-line align-baseline">
                  <td className="max-w-[18rem] truncate px-3 py-1" title={`${l.CompteNum} – ${l.CompteLib}`}>
                    <Link to={`/grand-livre?compte=${encodeURIComponent(l.CompteNum)}`} className="font-mono text-accent underline-offset-2 hover:underline" title={`Ouvrir le compte ${l.CompteNum} dans le grand livre`}>
                      {l.CompteNum}
                    </Link>{' '}
                    <span className="text-muted">{l.CompteLib}</span>
                  </td>
                  <td className="max-w-[12rem] truncate px-2 py-1" title={l.CompAuxNum ? `${l.CompAuxNum} – ${l.CompAuxLib}` : undefined}>
                    {l.CompAuxNum ? (
                      <>
                        <span className="font-mono">{l.CompAuxNum}</span> <span className="text-muted">{l.CompAuxLib}</span>
                      </>
                    ) : (
                      ''
                    )}
                  </td>
                  <td className="max-w-[24rem] truncate px-2 py-1" title={l.EcritureLib}>
                    {l.EcritureLib}
                  </td>
                  <td className="px-2 py-1 text-right">
                    <Amount cents={l.debitCents} decimals={2} />
                  </td>
                  <td className="px-2 py-1 text-right">
                    <Amount cents={l.creditCents} decimals={2} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-1 font-mono">
                    {l.EcritureLet}
                    {l.DateLet && <span className="text-muted"> {formatFecDate(l.DateLet)}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-line font-semibold">
                <th scope="row" colSpan={3} className="px-3 py-1 text-left">
                  Total
                </th>
                <td className="px-2 py-1 text-right">
                  <Amount cents={debit} decimals={2} />
                </td>
                <td className="px-2 py-1 text-right">
                  <Amount cents={credit} decimals={2} />
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="px-3 py-2">
          <h3 className="text-xs font-semibold">Couples de comptes (débit → crédit)</h3>
          {pairs === null ? (
            <p className="mt-1 text-xs text-muted">Écriture non retenue pour l’analyse des couples de comptes : à-nouveaux ou écriture de plus de {index.maxLinesForPairs} lignes.</p>
          ) : pairs.length === 0 ? (
            <p className="mt-1 text-xs text-muted">Aucun couple de comptes distincts au débit et au crédit.</p>
          ) : (
            <>
              <p className="mt-1 text-xs text-muted">
                {rare.length === 0
                  ? `Aucun couple de l’écriture n’est rare (vu dans ${plural(threshold, 'écriture', 'écritures')} au plus sur l’exercice).`
                  : `${plural(rare.length, 'couple rare', 'couples rares')} : vu${rare.length > 1 ? 's' : ''} dans ${plural(threshold, 'écriture', 'écritures')} au plus sur l’exercice.`}
              </p>
              {rare.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-xs" aria-label="Couples de comptes rares">
                  {pairs
                    .filter((p) => p.count <= threshold)
                    .map((p) => (
                      <li key={p.pair} className="flex flex-wrap items-baseline gap-x-1.5">
                        <span>{account(p.debit)}</span>
                        <span aria-hidden>→</span><span className="sr-only">vers</span>
                        <span>{account(p.credit)}</span>
                        <Badge tone="muted">{plural(p.count, 'écriture', 'écritures')} sur l’exercice</Badge>
                      </li>
                    ))}
                </ul>
              )}
              <details className="mt-1.5 text-xs">
                <summary className="cursor-pointer text-accent">Tous les couples de l’écriture ({pairs.length})</summary>
                <ul className="mt-1 space-y-0.5">
                  {pairs.map((p) => (
                    <li key={p.pair} className="flex flex-wrap items-baseline gap-x-1.5">
                      <span>{account(p.debit)}</span>
                      <span aria-hidden>→</span><span className="sr-only">vers</span>
                      <span>{account(p.credit)}</span>
                      <span className="text-muted">– {plural(p.count, 'écriture', 'écritures')}</span>
                    </li>
                  ))}
                </ul>
              </details>
            </>
          )}
        </div>

        {designer && diagnostic && (
          <div className="mx-3 mb-3 rounded-md border border-warn/40 bg-warn/10 px-2.5 py-2 text-xs">
            <p className="font-semibold text-warn">Concepteur</p>
            <p>
              Origine : <span className="font-mono">{diagnostic.origin}</span>
            </p>
            <p>
              Monde propre :{' '}
              {diagnostic.change === 'added' ? 'écriture absente du monde propre (créée par une anomalie).' : diagnostic.change === 'modified' ? 'écriture modifiée par rapport au monde propre (montants, dates ou lignes).' : 'écriture identique au monde propre.'}
            </p>
            <p className="font-mono text-muted">Identifiant interne : {entryId}</p>
          </div>
        )}
      </div>
    </section>
  );
}
