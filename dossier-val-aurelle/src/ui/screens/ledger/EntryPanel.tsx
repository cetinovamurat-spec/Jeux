/**
 * Entry panel of the general ledger: every line of the journal entry of the
 * selected ledger line (contra accounts), with its references; links to the
 * ledger of each account and to the FEC explorer. Non-modal side panel,
 * closed with Escape.
 */
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router';
import { formatDateFr } from '../../../engine/dates';
import type { Year } from '../../app/case';
import { useCase } from '../../app/context';
import { cycleOfAccount } from '../../../game/planning';
import { Badge, cx } from '../../components/ui';
import { NewFindingButton } from '../findings/NewFindingButton';
import { RequestButton } from '../tools/RequestControls';
import { fecDateFr, formatCount, plural } from '../balance/format';
import { Signed } from '../balance/tableParts';

export interface EntryPanelProps {
  year: Year;
  entryId: string;
  /** Account whose ledger is shown (its lines are highlighted). */
  account: string;
  /** Default year of the screens (links omit it). */
  defaultYear: number;
  onClose: () => void;
  /** Designer mode: origin of the entry ('gen:…', 'anomaly:…'). */
  origin?: string;
}

export function EntryPanel({ year, entryId, account, defaultYear, onClose, origin }: EntryPanelProps) {
  const c = useCase();
  const index = c.fecIndex(year);
  const lines = useMemo(() => (index.entryLines.get(entryId) ?? []).map((i) => index.lines[i]!), [index, entryId]);
  const first = lines[0];
  const closeRef = useRef<HTMLButtonElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, [entryId]);

  // Long entries (opening entry, summaries): bring the first line of the account into view.
  useLayoutEffect(() => {
    const box = bodyRef.current;
    const row = box?.querySelector<HTMLElement>('tr[data-own]');
    const head = box?.querySelector<HTMLElement>('thead');
    const foot = box?.querySelector<HTMLElement>('tfoot');
    if (!box || !row) return;
    const b = box.getBoundingClientRect();
    const r = row.getBoundingClientRect();
    const top = b.top + (head?.offsetHeight ?? 0);
    const bottom = b.bottom - (foot?.offsetHeight ?? 0);
    if (r.top < top || r.bottom > bottom) box.scrollTop += r.top - top - r.height;
  }, [entryId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // an Escape already handled elsewhere (command palette, menu) leaves the panel open
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      e.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const totals = useMemo(() => {
    let debit = 0;
    let credit = 0;
    for (const l of lines) {
      debit += l.debitCents;
      credit += l.creditCents;
    }
    return { debit, credit };
  }, [lines]);
  const lineLabels = useMemo(() => new Set(lines.map((l) => l.EcritureLib)).size > 1, [lines]);
  const yearQuery = year === defaultYear ? '' : `&exercice=${year}`;

  return (
    <aside role="dialog" aria-modal="false" aria-labelledby="gl-entry-title" className="fixed inset-y-0 right-0 z-30 flex w-[min(46rem,100vw)] flex-col border-l border-line bg-panel shadow-2xl">
      <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs text-muted">Écriture comptable – exercice {year}</p>
          <h2 id="gl-entry-title" className="text-base font-semibold">
            {first ? (
              <>
                <span className="font-mono">{first.EcritureNum}</span> <span className="font-normal text-muted">–</span> {first.JournalLib}
              </>
            ) : (
              'Écriture introuvable'
            )}
          </h2>
          {first && <p className="mt-0.5 text-sm">{first.EcritureLib}</p>}
        </div>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Fermer l’écriture (Échap)" title="Fermer (Échap)" className="rounded-md px-2 py-1 text-muted hover:bg-sunken hover:text-ink">
          <span aria-hidden="true">✕</span>
        </button>
      </header>

      {first && (
        <dl className="grid grid-cols-3 gap-x-4 gap-y-2 border-b border-line px-4 py-3 text-sm">
          <div>
            <dt className="text-xs text-muted">Journal</dt>
            <dd>
              <span className="font-mono">{first.JournalCode}</span> – {first.JournalLib}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Date de l’écriture</dt>
            <dd className="font-mono">{formatDateFr(first.date)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Pièce</dt>
            <dd>
              {first.PieceRef ? (
                <>
                  <span className="font-mono">{first.PieceRef}</span>
                  {first.PieceDate && <span className="text-muted"> du {fecDateFr(first.PieceDate)}</span>}
                </>
              ) : (
                <span className="text-muted">Aucune référence</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Validée le</dt>
            <dd className="font-mono">{formatDateFr(first.validDate)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Saisie par</dt>
            <dd className="font-mono">{first.enteredBy}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Lignes</dt>
            <dd>{formatCount(lines.length)}</dd>
          </div>
        </dl>
      )}

      <div ref={bodyRef} className="min-h-0 flex-1 overflow-auto">
        <table className="w-full table-fixed text-sm">
          <caption className="sr-only">Lignes de l’écriture (comptes et contreparties)</caption>
          <colgroup>
            <col className="w-[5rem]" />
            <col />
            <col className="w-[8rem]" />
            {lineLabels && <col />}
            <col className="w-[9rem]" />
            <col className="w-[9rem]" />
          </colgroup>
          <thead className="sticky top-0 bg-sunken text-xs text-muted">
            <tr>
              <th scope="col" className="px-2 py-1.5 text-left font-semibold">Compte</th>
              <th scope="col" className="px-2 py-1.5 text-left font-semibold">Intitulé</th>
              <th scope="col" className="px-2 py-1.5 text-left font-semibold">Auxiliaire</th>
              {lineLabels && <th scope="col" className="px-2 py-1.5 text-left font-semibold">Libellé</th>}
              <th scope="col" className="px-2 py-1.5 text-right font-semibold">Débit</th>
              <th scope="col" className="px-2 py-1.5 text-right font-semibold">Crédit</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const own = l.CompteNum === account;
              const accountLabel = l.CompteLib || c.accountLabel(l.CompteNum);
              return (
                <tr key={i} data-own={own || undefined} className={cx('border-t border-line', own && 'bg-accent-soft')}>
                  <td className="px-2 py-1 font-mono text-[13px]">
                    {own ? (
                      <span title="Compte consulté">{l.CompteNum}</span>
                    ) : (
                      <Link to={`/grand-livre?compte=${encodeURIComponent(l.CompteNum)}${yearQuery}`} className="text-accent underline-offset-2 hover:underline" title={`Ouvrir le grand livre du compte ${l.CompteNum}`}>
                        {l.CompteNum}
                      </Link>
                    )}
                  </td>
                  <td className="truncate px-2 py-1" title={accountLabel}>
                    {accountLabel}
                    {own && <span className="sr-only"> (compte consulté)</span>}
                  </td>
                  <td className="truncate px-2 py-1" title={l.CompAuxNum ? `${l.CompAuxNum} – ${l.CompAuxLib}` : undefined}>
                    {l.CompAuxNum ? (
                      <>
                        <span className="font-mono text-[13px]">{l.CompAuxNum}</span> <span className="text-muted">{l.CompAuxLib}</span>
                      </>
                    ) : null}
                  </td>
                  {lineLabels && (
                    <td className="truncate px-2 py-1" title={l.EcritureLib}>
                      {l.EcritureLib}
                    </td>
                  )}
                  <td className="px-2 py-1 text-right text-[13px]">{l.debitCents ? <Signed cents={l.debitCents} /> : null}</td>
                  <td className="px-2 py-1 text-right text-[13px]">{l.creditCents ? <Signed cents={l.creditCents} /> : null}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="sticky bottom-0 bg-sunken">
            <tr className="border-t border-line font-semibold">
              <td colSpan={lineLabels ? 4 : 3} className="px-2 py-1.5 text-xs">
                Total de l’écriture ({plural(lines.length, 'ligne', 'lignes')}){' '}
                {totals.debit === totals.credit ? <Badge tone="ok">Équilibrée</Badge> : <Badge tone="ko">Déséquilibrée</Badge>}
              </td>
              <td className="px-2 py-1.5 text-right text-[13px]">
                <Signed cents={totals.debit} strong />
              </td>
              <td className="px-2 py-1.5 text-right text-[13px]">
                <Signed cents={totals.credit} strong />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2 text-sm">
        {first && (
          <span className="flex flex-wrap items-center gap-3">
            <Link to={`/fec?ecriture=${encodeURIComponent(first.EcritureNum)}&exercice=${year}`} className="font-medium text-accent underline-offset-2 hover:underline">
              Ouvrir dans le FEC
            </Link>
            <RequestButton compact family="entry-voucher" object={`${year}:${first.EcritureNum}`} />
            <NewFindingButton
              compact
              seed={{
                cycle: cycleOfAccount(account, c.params.cycles.cycles),
                objects: [{ kind: 'account', id: account }],
                evidence: [{ kind: 'fec', year, num: first.EcritureNum }],
                label: `Écriture ${first.EcritureNum} (${year}) – ${first.EcritureLib}`,
              }}
            />
          </span>
        )}
        {origin !== undefined && (
          <span className="text-xs text-muted">
            Concepteur – origine : {origin.startsWith('gen:') ? <span className="font-mono">{origin}</span> : <Badge tone="warn">{origin}</Badge>}
          </span>
        )}
      </footer>
    </aside>
  );
}
