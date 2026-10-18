/**
 * Master worksheets by cycle (plan J4 §12): N, N-1 and the variation at the
 * data vintage available, explained variations with their evidence, derived
 * references to the work of the cycle, conclusion chosen from a list and the
 * manager's form check. Nothing is flagged by the key: the variations to
 * explain follow the generic thresholds of the analytical review.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { formatDateFr } from '../../../engine/dates';
import { formatEuro, formatPercent } from '../../../engine/format';
import { planningThreshold } from '../../../game/planning';
import { EXECUTION_STATUS_LABEL, executionStatus, procedureDef } from '../../../game/program';
import { concludeMasterSheet, emptyMasterSheet, explainVariation, MASTER_STATUS_LABEL, masterFormCheck, masterReferences, masterRows, masterSheetOf, masterStatus, removeExplanation, variationsToExplain, type MasterRow, type MasterStatus } from '../../../game/worksheets';
import { TOOL_DEFS } from '../../../game/recalcs';
import { POPULATIONS } from '../../../game/samples';
import type { Tone } from '../../../game/state';
import { useCase } from '../../app/context';
import { useAvailableDocuments } from '../../app/hooks';
import { useGame } from '../../app/store';
import { Amount } from '../../components/Amount';
import { Badge, Button, Card, cx, Select, TextInput } from '../../components/ui';
import { Field } from '../planning/Field';
import { useWorkContext } from './hooks';
import { useWorkView } from './workStore';

const MASTER_TONE: Record<MasterStatus, Tone> = { notStarted: 'muted', inProgress: 'accent', concluded: 'ok' };

/** Stable empty sheet: a store selector must not return a new object on every call. */
const EMPTY_SHEET = emptyMasterSheet();

function ExplainForm({ cycle, row, onDone }: { cycle: string; row: MasterRow; onDone: () => void }) {
  const fid = `explain-${cycle}-${row.id}`;
  const docs = useAvailableDocuments();
  const sorted = useMemo(() => [...docs].sort((a, b) => a.title.localeCompare(b.title, 'fr')), [docs]);
  const sheet = useGame((s) => s.game.worksheets.master[cycle]) ?? EMPTY_SHEET;
  const act = useGame((s) => s.act);
  const prev = sheet.explained[row.id];
  const c = useCase();
  const params = c.params;
  const [text, setText] = useState(prev?.text ?? '');
  const [evidence, setEvidence] = useState<string[]>(prev?.evidence ?? []);
  const [pick, setPick] = useState('');
  return (
    <div className="space-y-2 rounded-md bg-sunken px-3 py-2 text-sm">
      <Field id={`${fid}-text`} label={`Explication de la variation – ${row.label}`}>
        <TextInput id={`${fid}-text`} value={text} onChange={(e) => setText(e.target.value)} className="w-full" autoFocus />
      </Field>
      <div className="flex flex-wrap items-end gap-2">
        <Field id={`${fid}-doc`} label="Pièce justificative" className="flex-1">
          <Select id={`${fid}-doc`} value={pick} onChange={(e) => setPick(e.target.value)} className="w-full">
            <option value="">Choisir une pièce…</option>
            {sorted.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </Select>
        </Field>
        <Button
          disabled={!pick}
          onClick={() => {
            setEvidence((ev) => (ev.includes(pick) ? ev : [...ev, pick]));
            setPick('');
          }}
        >
          Ajouter la pièce
        </Button>
      </div>
      {evidence.length > 0 && (
        <ul className="space-y-0.5 text-xs">
          {evidence.map((d) => (
            <li key={d} className="flex items-center gap-2">
              {c.documentsById.get(d)?.title ?? d}
              <Button variant="ghost" className="px-1 py-0 text-xs" aria-label={`Retirer la pièce « ${c.documentsById.get(d)?.title ?? d} »`} onClick={() => setEvidence((ev) => ev.filter((x) => x !== d))}>
                Retirer
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Button
          variant="primary"
          disabled={!text.trim()}
          onClick={() => {
            act((s) => explainVariation(s, cycle, row.id, text, evidence, params));
            onDone();
          }}
        >
          Enregistrer l’explication
        </Button>
        {prev && (
          <Button
            variant="danger"
            onClick={() => {
              act((s) => removeExplanation(s, cycle, row.id));
              onDone();
            }}
          >
            Supprimer
          </Button>
        )}
        <Button variant="ghost" onClick={onDone}>
          Fermer
        </Button>
      </div>
    </div>
  );
}

function Sheet({ cycleId }: { cycleId: string }) {
  const c = useCase();
  const params = c.params;
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const w = useWorkContext();
  const cycle = params.cycles.cycles.find((x) => x.id === cycleId)!;
  const sheet = masterSheetOf(game, cycleId);
  const current = c.view.ledger2025 === 'none' ? null : c.balances().current;
  const rows = useMemo(() => masterRows(cycle, current, c.comparisonPrior()), [cycle, current, c]);
  const review = params.analysis.review.variationThresholds;
  const threshold = planningThreshold(game.planning);
  const amountThreshold = threshold ?? review.euros * 100;
  const toExplain = variationsToExplain(rows, amountThreshold, review.pct);
  const refs = masterReferences(game, params, cycle);
  const status = masterStatus(sheet, refs);
  const issues = masterFormCheck(sheet, refs, toExplain);
  const [editing, setEditing] = useState<string | null>(null);
  const [conclusion, setConclusion] = useState(sheet.conclusion ?? '');
  const [comment, setComment] = useState(sheet.comment);
  // N at the cutoff of the data available, N-1 at the same date of the previous year
  const currentLabel = c.view.ledger2025 === 'none' ? String(params.scenario.years.current) : `Au ${formatDateFr(c.view.cutoff)}`;
  const priorLabel = c.view.ledger2025 === 'none' ? `Au ${formatDateFr(`${params.scenario.years.prior}-12-31`)}` : `Au ${formatDateFr(c.view.priorCutoff)}`;
  const docs = refs.documents;

  return (
    <article aria-labelledby="master-title" className="rounded-lg border border-line bg-panel">
      <header className="flex flex-wrap items-center gap-2 px-4 py-3">
        <h2 id="master-title" className="text-base font-semibold">
          Feuille maîtresse – {cycle.label}
        </h2>
        <Badge tone={MASTER_TONE[status]}>{MASTER_STATUS_LABEL[status]}</Badge>
        <p className="basis-full text-xs text-muted">{cycle.description}</p>
      </header>
      {cycle.lines.length > 0 && (
        <div className="overflow-x-auto border-t border-line">
          <table className="w-full text-sm">
            <caption className="sr-only">Soldes du cycle, exercice et exercice précédent à la même date, variation</caption>
            <thead>
              <tr className="border-b border-line text-xs text-muted">
                <th scope="col" className="min-w-[11rem] px-3 py-1.5 text-left font-medium">
                  Rubrique
                </th>
                <th scope="col" className="px-2 py-1.5 text-right font-medium whitespace-nowrap">
                  {currentLabel}
                </th>
                <th scope="col" className="px-2 py-1.5 text-right font-medium whitespace-nowrap">
                  {priorLabel}
                </th>
                <th scope="col" className="px-2 py-1.5 text-right font-medium">
                  Variation
                </th>
                <th scope="col" className="px-2 py-1.5 text-right font-medium">
                  %
                </th>
                <th scope="col" className="min-w-[12rem] px-3 py-1.5 text-left font-medium">
                  Explication
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const ex = sheet.explained[r.id];
                const flagged = toExplain.includes(r);
                return [
                  <tr key={r.id} className="border-b border-line">
                    <th scope="row" className="px-3 py-1 text-left font-normal">
                      {r.label}
                    </th>
                    <td className="px-2 py-1 text-right">{r.current === null ? <span className="text-xs text-muted">non disponible</span> : <Amount cents={r.current} />}</td>
                    <td className="px-2 py-1 text-right">
                      <Amount cents={r.prior} />
                    </td>
                    <td className="px-2 py-1 text-right">{r.variation === null ? '–' : <Amount cents={r.variation} />}</td>
                    <td className="num px-2 py-1 text-right">{r.variationPct === null ? '–' : formatPercent(r.variationPct, 1)}</td>
                    <td className="px-3 py-1">
                      <div className="flex items-center gap-2">
                        {ex ? (
                          <span className="text-xs">
                            {ex.text}
                            {ex.evidence.length > 0 && <span className="text-muted"> ({ex.evidence.length} pièce{ex.evidence.length > 1 ? 's' : ''})</span>}
                          </span>
                        ) : flagged ? (
                          <span className="text-xs whitespace-nowrap text-warn">à expliquer</span>
                        ) : null}
                        <Button variant="ghost" className="ml-auto px-1.5 py-0 text-xs" aria-expanded={editing === r.id} onClick={() => setEditing(editing === r.id ? null : r.id)} aria-label={`Expliquer la variation – ${r.label}`}>
                          {ex ? 'Modifier' : 'Expliquer'}
                        </Button>
                      </div>
                    </td>
                  </tr>,
                  editing === r.id ? (
                    <tr key={`${r.id}-edit`} className="border-b border-line">
                      <td colSpan={6} className="px-3 py-2">
                        <ExplainForm cycle={cycleId} row={r} onDone={() => setEditing(null)} />
                      </td>
                    </tr>
                  ) : null,
                ];
              })}
            </tbody>
          </table>
          <p className="px-3 py-1.5 text-xs text-muted">
            Variations à expliquer : au moins {formatEuro(amountThreshold, 0)} {threshold !== null ? '(seuil de planification)' : ''} et {review.pct} %.
          </p>
        </div>
      )}
      <section aria-labelledby="master-refs" className="border-t border-line px-4 py-3 text-sm">
        <h3 id="master-refs" className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
          Références des travaux
        </h3>
        {refs.executions.length === 0 && refs.findings.length === 0 && refs.queries.length === 0 && docs.length === 0 && refs.samples.length === 0 && refs.recalcs.length === 0 ? (
          <p className="text-muted">Aucun travail sur ce cycle pour l’instant.</p>
        ) : (
          <ul className="space-y-0.5">
            {refs.executions.map((id) => {
              const e = game.program.executions.find((x) => x.id === id)!;
              const st = executionStatus(e, w.sched.get(e.id), game.clock.date);
              return (
                <li key={id}>
                  <button type="button" className="text-left text-accent hover:underline" onClick={() => useWorkView.getState().set({ selected: e.procedureId })}>
                    {procedureDef(params, e.procedureId)?.title ?? e.procedureId}
                  </button>{' '}
                  <span className="text-xs text-muted">({EXECUTION_STATUS_LABEL[st].toLowerCase()})</span>
                </li>
              );
            })}
            {refs.samples.map((id) => {
              const x = game.samples.items.find((it) => it.id === id);
              const label = POPULATIONS.find((p) => p.id === x?.population)?.label;
              return (
                <li key={id}>
                  Échantillon{label ? ` – ${label}` : ''} {x && <span className="text-xs text-muted">(tiré le {formatDateFr(x.drawnOn)})</span>}
                </li>
              );
            })}
            {refs.recalcs.map((id) => {
              const x = game.recalcs.items.find((it) => it.id === id);
              const label = x ? TOOL_DEFS[x.tool as keyof typeof TOOL_DEFS]?.label : undefined;
              return (
                <li key={id}>
                  Recalcul{label ? ` – ${label}` : ''} {x && <span className="text-xs text-muted">(le {formatDateFr(x.on)})</span>}
                </li>
              );
            })}
            {refs.findings.map((id) => (
              <li key={id}>
                <Link to="/constats" className="text-accent hover:underline">
                  Constat {id}
                </Link>
              </li>
            ))}
            {refs.queries.map((id) => (
              <li key={id}>
                <Link to={`/fec?requete=${encodeURIComponent(id)}`} className="text-accent hover:underline">
                  Requête « {game.savedQueries.find((q) => q.id === id)?.name ?? id} »
                </Link>
              </li>
            ))}
            {docs.map((id) => (
              <li key={id}>
                <Link to={`/ged/${encodeURIComponent(id)}`} className="text-accent hover:underline">
                  {c.documentsById.get(id)?.title ?? id}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="master-conclusion" className="space-y-2 border-t border-line px-4 py-3 text-sm">
        <h3 id="master-conclusion" className="text-xs font-semibold uppercase tracking-wide text-muted">
          Conclusion
        </h3>
        <Field id={`master-${cycleId}-conclusion`} label="Conclusion du cycle">
          <Select id={`master-${cycleId}-conclusion`} value={conclusion} onChange={(e) => setConclusion(e.target.value)} className="w-full">
            <option value="">Pas encore de conclusion</option>
            {params.cycles.conclusions.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field id={`master-${cycleId}-comment`} label="Commentaire">
          <textarea id={`master-${cycleId}-comment`} value={comment} onChange={(e) => setComment(e.target.value)} rows={3} className="w-full rounded-md border border-line bg-panel px-2 py-1 text-sm" />
        </Field>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" onClick={() => act((s) => concludeMasterSheet(s, params, cycleId, conclusion || null, comment))}>
            Enregistrer
          </Button>
          {sheet.on && sheet.conclusion && <span className="text-xs text-muted">Conclue le {formatDateFr(sheet.on)}</span>}
        </div>
        {issues.length > 0 && (
          <div className="rounded-md border border-warn/40 bg-warn/10 px-3 py-1.5">
            <p className="text-xs font-semibold">Contrôle de forme du manager</p>
            <ul className="list-disc pl-5">
              {issues.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </article>
  );
}

export function MasterSheets() {
  const c = useCase();
  const params = c.params;
  const game = useGame((s) => s.game);
  const { cycle, set } = useWorkView();
  return (
    <div className="grid gap-4 xl:grid-cols-[16rem_minmax(0,1fr)]">
      <Card title="Cycles">
        <ul className="flex flex-wrap gap-1 p-2 text-sm xl:block xl:p-0 xl:py-1">
          {params.cycles.cycles.map((cy) => {
            const st = masterStatus(masterSheetOf(game, cy.id), masterReferences(game, params, cy));
            const selected = cy.id === cycle;
            return (
              <li key={cy.id}>
                <button type="button" aria-current={selected ? 'true' : undefined} onClick={() => set({ cycle: cy.id })} className={cx('flex w-full items-center justify-between gap-2 rounded-md px-3 py-1.5 text-left hover:bg-sunken xl:rounded-none', selected && 'bg-accent-soft font-semibold text-accent')}>
                  <span className="min-w-0">{cy.label}</span>
                  <Badge tone={MASTER_TONE[st]}>{MASTER_STATUS_LABEL[st]}</Badge>
                </button>
              </li>
            );
          })}
        </ul>
      </Card>
      <Sheet key={cycle} cycleId={cycle} />
    </div>
  );
}
