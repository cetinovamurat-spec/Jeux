/**
 * External confirmations (plan J4 §9, J4-7): before the automatic sending,
 * choice of the third parties to confirm, by population (each request
 * prepared costs time); after it, the tracker (sent, reply received, without
 * reply), reminders and « Créer un constat ». The reconciliation of a reply
 * with the books is the player's work: no difference is computed here.
 */
import { useMemo } from 'react';
import { Link } from 'react-router';
import { formatDateFr } from '../../../engine/dates';
import {
  canPrepare,
  confirmationCandidates,
  POPULATION_CYCLE,
  POPULATION_ORDER,
  prepareConfirmation,
  remindConfirmation,
  sendingDate,
  withdrawConfirmation,
  type ConfirmationCandidate,
  type ConfirmationPopulation,
  type ConfirmationState,
} from '../../../game/confirmations';
import type { MemberId } from '../../../game/calendar';
import type { Tone } from '../../../game/state';
import { useCase } from '../../app/context';
import { useGame } from '../../app/store';
import { Amount } from '../../components/Amount';
import { Badge, Button, cx } from '../../components/ui';
import { NewFindingButton } from '../findings/NewFindingButton';
import { CONFIRMATION_STATE_LABELS, plural, POPULATION_LABELS } from '../ged/labels';
import { useConfirmationRows } from '../ged/replies';

const STATE_TONE: Readonly<Record<ConfirmationState, Tone>> = { prepared: 'accent', notSent: 'muted', sent: 'muted', replied: 'ok', noReply: 'warn' };

function formatHours(h: number): string {
  return h.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
}

/** Candidates of the populations, from the presented data (cached per case). */
function useCandidates(populations: readonly ConfirmationPopulation[]): ConfirmationCandidate[] {
  const c = useCase();
  const all = useMemo(() => confirmationCandidates(c.params, c.datasets), [c]);
  return useMemo(() => all.filter((x) => populations.includes(x.population)), [all, populations]);
}

/** Execution of the programme the panel is opened in: the requests are prepared by its assignee, within its hours. */
export interface PanelExecution {
  id: string;
  by: MemberId;
}

function Preparation({ populations, idPrefix, execution }: { populations: readonly ConfirmationPopulation[]; idPrefix: string; execution?: PanelExecution | undefined }) {
  const c = useCase();
  const params = c.params;
  const act = useGame((s) => s.act);
  const items = useGame((s) => s.game.confirmations.items);
  const prepared = new Set(items.map((x) => x.thirdParty));
  const candidates = useCandidates(populations);
  const n = candidates.filter((x) => prepared.has(x.thirdParty)).length;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Les demandes préparées partent automatiquement le {formatDateFr(sendingDate(params))} ; après cette date, seules des procédures alternatives restent possibles. {execution
          ? 'Le temps de préparation est compris dans les heures de la procédure.'
          : `Chaque demande préparée coûte ${formatHours(params.requests.confirmations.preparationHours)} h.`}
      </p>
      <p className="text-sm" aria-live="polite">
        {plural(n, 'demande préparée', 'demandes préparées')} sur {plural(candidates.length, 'tiers proposé', 'tiers proposés')}
      </p>
      {POPULATION_ORDER.filter((pop) => populations.includes(pop)).map((pop) => {
        const rows = candidates.filter((x) => x.population === pop);
        if (!rows.length) return null;
        const headId = `${idPrefix}-${pop}`;
        return (
          <section key={pop} aria-labelledby={headId}>
            <h4 id={headId} className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
              {POPULATION_LABELS[pop] ?? pop}
            </h4>
            <table className="w-full text-sm">
              <caption className="sr-only">Tiers proposés pour une demande de confirmation : {POPULATION_LABELS[pop] ?? pop}</caption>
              <thead>
                <tr className="border-b border-line text-xs text-muted">
                  <th scope="col" className="w-24 px-2 py-1 text-left font-medium">
                    Préparer
                  </th>
                  <th scope="col" className="px-2 py-1 text-left font-medium">
                    Tiers
                  </th>
                  <th scope="col" className="px-2 py-1 text-left font-medium">
                    Objet de la demande
                  </th>
                  <th scope="col" className="px-2 py-1 text-right font-medium">
                    Donnée de sélection
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((x) => {
                  const id = `${idPrefix}-prep-${x.thirdParty}`;
                  const on = prepared.has(x.thirdParty);
                  return (
                    <tr key={x.thirdParty} className="border-b border-line last:border-b-0">
                      <td className="px-2 py-1">
                        <input
                          id={id}
                          type="checkbox"
                          checked={on}
                          onChange={(e) => act((s) => (e.target.checked ? prepareConfirmation(s, x.thirdParty, x.name, execution?.by ?? 'senior', params, execution?.id) : withdrawConfirmation(s, x.thirdParty, params)))}
                          className="accent-[var(--accent)]"
                        />
                      </td>
                      <th scope="row" className="px-2 py-1 text-left font-normal">
                        <label htmlFor={id} className="cursor-pointer">
                          {x.name}
                        </label>
                      </th>
                      <td className="px-2 py-1 text-muted">{x.subject}</td>
                      <td className="px-2 py-1 text-right">{x.amount !== null ? <Amount cents={x.amount} /> : <span className="text-muted">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        );
      })}
    </div>
  );
}

function Tracker({ populations }: { populations: readonly ConfirmationPopulation[] }) {
  const c = useCase();
  const params = c.params;
  const act = useGame((s) => s.act);
  const date = useGame((s) => s.game.clock.date);
  const rows = useConfirmationRows();
  const candidates = useCandidates(populations);
  const byId = new Map(candidates.map((x) => [x.thirdParty, x]));
  const mine = rows.filter((r) => byId.has(r.item.thirdParty));
  const notSent = candidates.filter((x) => !rows.some((r) => r.item.thirdParty === x.thirdParty)).length;
  const sending = sendingDate(params);
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted">
        Demandes envoyées le {formatDateFr(sending)}. Rapprochez chaque réponse de la comptabilité ; pour un tiers silencieux, mettez en œuvre des procédures alternatives.
      </p>
      {notSent > 0 && <p className="text-sm text-muted">{plural(notSent, 'tiers proposé n’a pas fait', 'tiers proposés n’ont pas fait')} l’objet d’une demande.</p>}
      {mine.length === 0 ? (
        <p className="rounded-md border border-line px-3 py-4 text-center text-sm text-muted">Aucune demande de confirmation n’a été envoyée pour ces tiers.</p>
      ) : (
        <table className="w-full text-sm">
          <caption className="sr-only">Suivi des demandes de confirmation</caption>
          <thead>
            <tr className="border-b border-line text-xs text-muted">
              <th scope="col" className="px-2 py-1 text-left font-medium">
                Tiers
              </th>
              <th scope="col" className="px-2 py-1 text-left font-medium">
                Statut
              </th>
              <th scope="col" className="px-2 py-1 text-left font-medium">
                Réponse
              </th>
              <th scope="col" className="px-2 py-1 text-right font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {mine.map((r) => {
              const cand = byId.get(r.item.thirdParty)!;
              const replied = r.state === 'replied' && r.reply;
              const canRemind = (r.state === 'sent' || r.state === 'noReply') && date > sending;
              return (
                <tr key={r.item.thirdParty} className="border-b border-line align-top last:border-b-0">
                  <th scope="row" className="px-2 py-1.5 text-left font-normal">
                    {cand.name}
                    <span className="block text-xs text-muted">{POPULATION_LABELS[cand.population] ?? cand.population}</span>
                  </th>
                  <td className="whitespace-nowrap px-2 py-1.5">
                    <Badge tone={STATE_TONE[r.state]}>{CONFIRMATION_STATE_LABELS[r.state] ?? r.state}</Badge>
                    {r.item.remindedOn && <span className="block text-xs text-muted">Relancé le {formatDateFr(r.item.remindedOn)}</span>}
                  </td>
                  <td className="px-2 py-1.5">
                    {replied ? (
                      <Link to={`/ged/${encodeURIComponent(r.reply!.id)}?onglet=documents`} className="text-accent underline-offset-2 hover:underline">
                        Reçue le {formatDateFr(r.replyOn!)}
                      </Link>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex flex-wrap justify-end gap-1">
                      {canRemind && (
                        <Button className="px-1.5 py-0 text-xs" onClick={() => act((s) => remindConfirmation(s, r.item.thirdParty, cand.name, params))} disabled={r.item.remindedOn === date} title={`Relancer ${cand.name} (${formatHours(params.requests.confirmations.reminderHours)} h)`}>
                          Relancer
                        </Button>
                      )}
                      {(replied || r.state === 'noReply') && (
                        <NewFindingButton
                          compact
                          seed={{
                            cycle: POPULATION_CYCLE[cand.population],
                            objects: [{ kind: 'thirdParty', id: r.item.thirdParty }],
                            evidence: [{ kind: 'confirmation', id: r.item.thirdParty }, ...(replied ? [{ kind: 'doc' as const, docId: r.reply!.id }] : [])],
                            label: r.state === 'noReply' ? `Demande de confirmation sans réponse – ${cand.name}` : `Réponse à la demande de confirmation – ${cand.name}`,
                          }}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

/** Confirmations of the given populations (all of them by default): preparation before the sending, tracker after it. */
export function ConfirmationsPanel({ populations = POPULATION_ORDER, idPrefix = 'conf', execution }: { populations?: readonly ConfirmationPopulation[]; idPrefix?: string; execution?: PanelExecution }) {
  const c = useCase();
  const date = useGame((s) => s.game.clock.date);
  return <div className={cx('min-w-0')}>{canPrepare(c.params, date) ? <Preparation populations={populations} idPrefix={idPrefix} execution={execution} /> : <Tracker populations={populations} />}</div>;
}
