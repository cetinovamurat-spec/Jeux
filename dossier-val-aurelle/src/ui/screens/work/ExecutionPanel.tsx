/**
 * Worksheet of a procedure (plan J4 §7, J4-10): before the launch, the
 * assignee and the launch check; after it, the status and dates, the tool of
 * the procedure, the work prepared by a delegated member, the completion
 * criteria, the references, the conclusion and the review fields of J5.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { useGedDocuments } from '../ged/replies';
import { Link } from 'react-router';
import { formatDateFr } from '../../../engine/dates';
import type { MemberId } from '../../../game/calendar';
import { availabilityContext, isAvailable } from '../../../game/documents';
import {
  addExecutionRef,
  allowedMembers,
  cancelExecution,
  canLaunch,
  completionOf,
  defaultAssignee,
  delegatedWorksheet,
  derivedRefs,
  documentExecution,
  EXECUTION_STATUS_LABEL,
  executionOf,
  executionStatus,
  formCheck,
  launchBudgetImpact,
  launchExecution,
  previewLaunch,
  procedureDef,
  procedureHours,
  removeExecutionRef,
  reviewExecution,
  updateExecution,
  type Execution,
  type ExecutionStatus,
  type WorkRef,
} from '../../../game/program';
import { TOOL_DEFS } from '../../../game/recalcs';
import { POPULATIONS } from '../../../game/samples';
import type { Tone } from '../../../game/state';
import type { ProcedureDef } from '../../../scenario/schemas/procedures';
import { useCase } from '../../app/context';
import { useGame } from '../../app/store';
import { Badge, Button, cx, Select, TextInput } from '../../components/ui';
import { NewFindingButton } from '../findings/NewFindingButton';
import { Field } from '../planning/Field';
import { cycleLabel, formatHours, MANDATORY_LABEL, memberLabel, memberShort, outputText, OVERRIDE_LABEL, phasesText } from '../planning/labels';
import { ToolForOutput } from '../tools/ToolForOutput';
import { useWorkContext } from './hooks';

export const STATUS_TONE: Record<ExecutionStatus, Tone> = { waiting: 'muted', inProgress: 'accent', delivered: 'warn', documented: 'ok', unfinishable: 'ko' };

function Section({ title, children, id }: { title: string; children: ReactNode; id: string }) {
  return (
    <section aria-labelledby={id} className="border-t border-line px-4 py-3">
      <h3 id={id} className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
        {title}
      </h3>
      {children}
    </section>
  );
}

function LaunchForm({ def }: { def: ProcedureDef }) {
  const c = useCase();
  const params = c.params;
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const w = useWorkContext();
  const planned = game.program.planned.find((p) => p.procedureId === def.id);
  const [member, setMember] = useState<MemberId>(planned?.assignee ?? defaultAssignee(def, params));
  const check = canLaunch(game, params, def.id, member, w.launch);
  const hours = procedureHours(def, member, params) ?? 0;
  const preview = check.ok ? previewLaunch(game.program, w.cal, member, hours, game.clock.date) : null;
  const impact = check.ok ? launchBudgetImpact(game, params, def.id, member) : null;
  const partner = params.game.firm.find((f) => f.id === 'partner')?.name ?? 'L’associée';
  const selectId = `work-member-${def.id}`;
  return (
    <Section title="Lancement" id={`work-launch-${def.id}`}>
      <div className="flex flex-wrap items-end gap-2 text-sm">
        <Field id={selectId} label="Intervenant">
          <Select id={selectId} value={member} onChange={(e) => setMember(e.target.value as MemberId)}>
            {allowedMembers(def, params).map((m) => (
              <option key={m} value={m}>
                {memberLabel(params, m)} – {formatHours(procedureHours(def, m, params)!)} h
              </option>
            ))}
          </Select>
        </Field>
        <Button variant="primary" disabled={!check.ok} onClick={() => act((s) => launchExecution(s, params, def.id, member, w.launch))}>
          Lancer la procédure
        </Button>
        {!planned && <span className="text-xs text-muted">Elle sera ajoutée au programme.</span>}
      </div>
      {preview && (
        <p className="mt-2 text-sm text-muted">
          {preview.end
            ? preview.start === preview.end
              ? `Travaux le ${formatDateFr(preview.start!)} ; feuille de travail livrée le jour même.`
              : `Travaux du ${formatDateFr(preview.start!)} au ${formatDateFr(preview.end)} ; feuille de travail livrée le ${formatDateFr(preview.end)}.`
            : 'La procédure ne pourra pas être terminée avant la fin de la présence sur site de l’intervenant.'}
        </p>
      )}
      {impact?.arbitration && (
        <p role="note" className="mt-2 rounded-md border border-warn/40 bg-warn/10 px-3 py-1.5 text-sm">
          Ce lancement porte les heures de l’équipe à {formatHours(impact.after)} h, au-delà du budget de {impact.budget} h et de sa tolérance : {partner} arbitrera
          {impact.justified ? ' ; le risque évalué sur ce cycle justifie le dépassement.' : ' ; sans risque élevé évalué ni constat significatif sur ce cycle, le dépassement ne sera pas justifié.'}
        </p>
      )}
      {!check.ok && (
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-warn">
          {check.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function RefLabel({ r }: { r: WorkRef }) {
  const c = useCase();
  const queries = useGame((s) => s.game.savedQueries);
  const requests = useGame((s) => s.game.requests.items);
  const samples = useGame((s) => s.game.samples.items);
  const recalcs = useGame((s) => s.game.recalcs.items);
  switch (r.kind) {
    case 'doc':
      return (
        <Link to={`/ged/${encodeURIComponent(r.id)}`} className="text-accent hover:underline">
          {c.documentsById.get(r.id)?.title ?? r.id}
          {r.block !== undefined ? ` – bloc ${r.block + 1}` : ''}
        </Link>
      );
    case 'query':
      return (
        <Link to={`/fec?requete=${encodeURIComponent(r.id)}`} className="text-accent hover:underline">
          Requête « {queries.find((q) => q.id === r.id)?.name ?? r.id} »
        </Link>
      );
    case 'request': {
      const q = requests.find((x) => x.id === r.id);
      const family = (c.params.requests.families as { id: string; label: string }[]).find((f) => f.id === q?.family);
      return (
        <span>
          Demande « {family?.label ?? q?.family ?? r.id} »{q?.object ? ` (${q.object})` : ''}
          {q && <span className="text-xs text-muted"> – envoyée le {formatDateFr(q.sentOn)}</span>}
        </span>
      );
    }
    case 'sample': {
      const x = samples.find((it) => it.id === r.id);
      const label = POPULATIONS.find((p) => p.id === x?.population)?.label;
      return (
        <span>
          Échantillon{label ? ` – ${label}` : ''}
          {x && <span className="text-xs text-muted"> – tiré le {formatDateFr(x.drawnOn)}, {x.items.length} éléments</span>}
        </span>
      );
    }
    case 'recalc': {
      const x = recalcs.find((it) => it.id === r.id);
      const label = x ? TOOL_DEFS[x.tool as keyof typeof TOOL_DEFS]?.label : undefined;
      return (
        <span>
          Recalcul{label ? ` – ${label}` : ''}
          {x && <span className="text-xs text-muted"> – le {formatDateFr(x.on)}</span>}
        </span>
      );
    }
    case 'confirmation':
      return <span>Demande de confirmation</span>;
    case 'finding':
      return (
        <Link to={`/constats?constat=${encodeURIComponent(r.id)}`} className="text-accent hover:underline">
          Constat {r.id}
        </Link>
      );
  }
}

function Worksheet({ def, e }: { def: ProcedureDef; e: Execution }) {
  const c = useCase();
  const params = c.params;
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const w = useWorkContext();
  const docs = useGedDocuments().available;
  const sortedDocs = useMemo(() => [...docs].sort((a, b) => a.title.localeCompare(b.title, 'fr')), [docs]);
  const t = w.sched.get(e.id);
  const status = executionStatus(e, t, game.clock.date);
  const derivedAll = derivedRefs(e, def, game, params, w.populationOf);
  const confirmations = derivedAll.filter((r) => r.kind === 'confirmation').length;
  const derived = derivedAll.filter((r) => r.kind !== 'confirmation');
  const completion = completionOf(e, def, status, w.completion);
  const issues = formCheck(e, status, [...derivedAll, ...e.refs]);
  const delegated = useMemo(() => {
    if (!t?.end) return null;
    const ctx = availabilityContext(game, params, t.end);
    return delegatedWorksheet(e, def, status, c.documents, (d) => isAvailable(d, ctx));
  }, [e, def, status, c, game, params, t]);
  const [conclusion, setConclusion] = useState(e.conclusion ?? '');
  const [comment, setComment] = useState(e.comment);
  const [docRef, setDocRef] = useState('');
  const [reviewComment, setReviewComment] = useState(e.review.comment ?? '');
  const delivered = status === 'delivered' || status === 'documented';
  const id = `work-${e.id}`;

  return (
    <>
      <Section title="Suivi" id={`${id}-follow`}>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-muted">Préparée par</dt>
            <dd>{memberLabel(params, e.assignee)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Heures imputées</dt>
            <dd className="num">{formatHours(e.hours)} h</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Lancée le</dt>
            <dd>{formatDateFr(e.launchedOn)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">{status === 'waiting' || status === 'inProgress' ? 'Livraison prévue le' : 'Livrée le'}</dt>
            <dd>{t?.end ? formatDateFr(t.end) : 'impossible avant la fin de la mission'}</dd>
          </div>
        </dl>
        {t?.start && status === 'waiting' && <p className="mt-1 text-xs text-muted">Début des travaux le {formatDateFr(t.start)} (selon la présence sur site et la file de travail de l’intervenant).</p>}
        {status === 'waiting' && (
          <Button variant="ghost" className="mt-1 px-1.5 py-0 text-xs" onClick={() => act((s) => cancelExecution(s, e.id, w.cal, params))}>
            Annuler le lancement
          </Button>
        )}
      </Section>
      <Section title="Outil de la procédure" id={`${id}-tool`}>
        <p className="mb-2 text-xs text-muted">{outputText(def)}</p>
        <ToolForOutput executionId={e.id} output={def.output} />
      </Section>
      {delegated && (
        <Section title={`Travail préparé par ${memberShort(params, delegated.preparer)}`} id={`${id}-delegated`}>
          {delegated.points.length === 0 ? (
            <p className="text-sm">Aucun point relevé. Conclusion proposée : satisfaisant.</p>
          ) : (
            <div className="text-sm">
              <p>Points relevés pour votre examen :</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {delegated.points.map((p) => (
                  <li key={p.docId}>
                    <Link to={`/ged/${encodeURIComponent(p.docId)}`} className="text-accent hover:underline">
                      {p.title}
                    </Link>
                    {p.blocks.length > 0 && <span className="text-xs text-muted"> – {p.blocks.map((b) => `bloc ${b + 1}`).join(', ')}</span>}
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-muted">Conclusion proposée : anomalies ou exceptions relevées, à examiner.</p>
            </div>
          )}
        </Section>
      )}
      <Section title="Achèvement" id={`${id}-completion`}>
        <ul className="space-y-0.5 text-sm">
          {completion.items.map((it) => (
            <li key={it.label} className="flex items-start gap-2">
              <span aria-hidden className={it.ok ? 'text-ok' : 'text-muted'}>
                {it.ok ? '☑' : '☐'}
              </span>
              <span className={cx(!it.ok && 'text-muted')}>
                {it.label}
                <span className="sr-only">{it.ok ? ' : fait' : ' : à faire'}</span>
              </span>
            </li>
          ))}
        </ul>
        {issues.length > 0 && (
          <div className="mt-2 rounded-md border border-warn/40 bg-warn/10 px-3 py-1.5 text-sm">
            <p className="text-xs font-semibold">Contrôle de forme du manager</p>
            <ul className="list-disc pl-5">
              {issues.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </div>
        )}
      </Section>
      <Section title="Références" id={`${id}-refs`}>
        {derivedAll.length + e.refs.length === 0 ? (
          <p className="text-sm text-muted">Aucune référence.</p>
        ) : (
          <ul className="space-y-0.5 text-sm">
            {confirmations > 0 && (
              <li>
                <Link to="/ged" className="text-accent hover:underline">
                  Demandes de confirmation préparées : {confirmations}
                </Link>{' '}
                <span className="text-xs text-muted">(produites par la procédure)</span>
              </li>
            )}
            {derived.map((r) => (
              <li key={`d-${r.kind}-${r.id}`}>
                <RefLabel r={r} /> <span className="text-xs text-muted">(produite par la procédure)</span>
              </li>
            ))}
            {e.refs.map((r) => (
              <li key={`p-${r.kind}-${r.id}-${r.kind === 'doc' ? (r.block ?? '') : ''}`} className="flex items-center gap-2">
                <RefLabel r={r} />
                <Button variant="ghost" className="px-1 py-0 text-xs" aria-label="Retirer la référence" onClick={() => act((s) => removeExecutionRef(s, e.id, r))}>
                  Retirer
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <Field id={`${id}-docref`} label="Lier une pièce de la gestion documentaire" className="flex-1">
            <Select id={`${id}-docref`} value={docRef} onChange={(ev) => setDocRef(ev.target.value)} className="w-full">
              <option value="">Choisir une pièce…</option>
              {sortedDocs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </Select>
          </Field>
          <Button
            disabled={!docRef}
            onClick={() => {
              act((s) => addExecutionRef(s, e.id, { kind: 'doc', id: docRef }));
              setDocRef('');
            }}
          >
            Lier
          </Button>
          <NewFindingButton seed={{ cycle: def.cycle, evidence: [{ kind: 'execution', id: e.id }], label: def.title }} />
        </div>
      </Section>
      <Section title="Conclusion" id={`${id}-conclusion`}>
        {!delivered ? (
          <p className="text-sm text-muted">La feuille se documente une fois livrée.</p>
        ) : (
          <div className="space-y-2 text-sm">
            <Field id={`${id}-conclusion-value`} label="Conclusion">
              <Select id={`${id}-conclusion-value`} value={conclusion} onChange={(ev) => setConclusion(ev.target.value)} className="w-full">
                <option value="">Choisir…</option>
                {params.procedures.conclusions.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id={`${id}-comment`} label="Commentaire">
              <textarea id={`${id}-comment`} value={comment} onChange={(ev) => setComment(ev.target.value)} rows={3} className="w-full rounded-md border border-line bg-panel px-2 py-1 text-sm" />
            </Field>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary" disabled={!conclusion} onClick={() => act((s) => documentExecution(s, params, e.id, conclusion, comment, w.cal))}>
                {e.conclusion ? 'Mettre à jour la feuille' : 'Documenter la feuille'}
              </Button>
              {e.conclusion !== null && def.completion.some((k) => k.kind === 'updated') && (
                <Button onClick={() => act((s) => updateExecution(s, e.id, params))} title="Mise à jour des travaux à la date du dossier">
                  Mettre à jour à la date du jour
                </Button>
              )}
              {e.documentedOn && (
                <span className="text-xs text-muted">
                  Documentée le {formatDateFr(e.documentedOn)}
                  {e.updatedOn ? `, mise à jour le ${formatDateFr(e.updatedOn)}` : ''}
                </span>
              )}
            </div>
          </div>
        )}
      </Section>
      {e.assignee !== 'senior' && delivered && (
        <Section title="Revue du senior" id={`${id}-review`}>
          <div className="flex flex-wrap items-end gap-2 text-sm">
            <Badge tone={e.review.status === 'accepted' ? 'ok' : e.review.status === 'returned' ? 'warn' : 'muted'}>{e.review.status === 'accepted' ? `Acceptée le ${formatDateFr(e.review.on ?? '')}` : e.review.status === 'returned' ? `Renvoyée le ${formatDateFr(e.review.on ?? '')}` : 'À revoir'}</Badge>
            <TextInput aria-label="Commentaire de revue" placeholder="Commentaire de revue (requis pour renvoyer)" value={reviewComment} onChange={(ev) => setReviewComment(ev.target.value)} className="min-w-0 flex-1" />
            <Button onClick={() => act((s) => reviewExecution(s, e.id, 'accepted', reviewComment, params))}>Accepter</Button>
            <Button onClick={() => act((s) => reviewExecution(s, e.id, 'returned', reviewComment, params))} disabled={!reviewComment.trim()}>
              Renvoyer
            </Button>
          </div>
        </Section>
      )}
    </>
  );
}

export function ExecutionPanel({ procedureId }: { procedureId: string }) {
  const c = useCase();
  const params = c.params;
  const program = useGame((s) => s.game.program);
  const date = useGame((s) => s.game.clock.date);
  const w = useWorkContext();
  const def = procedureDef(params, procedureId);
  if (!def) return <p className="p-4 text-sm text-muted">Procédure inconnue.</p>;
  const e = executionOf(program, procedureId);
  const status = e ? executionStatus(e, w.sched.get(e.id), date) : null;
  return (
    <article aria-labelledby="work-panel-title" className="rounded-lg border border-line bg-panel">
      <header className="px-4 py-3">
        <p className="text-xs text-muted">
          {cycleLabel(params, def.cycle)} · {phasesText(params, def)}
        </p>
        <h2 id="work-panel-title" className="text-base font-semibold">
          {def.title}
        </h2>
        <div className="mt-1 flex flex-wrap gap-1">
          {status ? <Badge tone={STATUS_TONE[status]}>{EXECUTION_STATUS_LABEL[status]}</Badge> : <Badge>Non lancée</Badge>}
          {def.mandatory && <Badge tone="accent">{MANDATORY_LABEL}</Badge>}
          {def.overrideResponse && <Badge tone="warn">{OVERRIDE_LABEL}</Badge>}
        </div>
        <p className="mt-2 text-sm">{def.objective}</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-muted">
          {def.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </header>
      {e ? <Worksheet key={e.id} def={def} e={e} /> : <LaunchForm key={def.id} def={def} />}
    </article>
  );
}
