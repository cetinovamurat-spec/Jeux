/**
 * Recalculation tool (plan J4 §11, J4-9), opened by a procedure: the client's
 * file (accessible once its source document has been obtained) and the
 * client's assumptions; the player changes an assumption by citing its source
 * (a document received or a parameter of the firm) — the result is shown only
 * once every changed assumption is sourced. The amounts recorded are read at
 * the posting grain; only the summary is saved, and a gap can become a
 * finding.
 */
import { useMemo, useState } from 'react';
import { formatDateFr } from '../../../engine/dates';
import { parseDecimal } from '../../../game/ledger';
import {
  assumptionBlocked,
  assumptionDefs,
  clientAssumptions,
  runRecalc,
  saveRecalc,
  TOOL_DEFS,
  toolAccess,
  toolScopes,
  unsourcedChanges,
  type AssumptionDef,
  type RecalcData,
  type RecalcToolId,
} from '../../../game/recalcs';
import { vintageDates } from '../../../game/vintages';
import type { DocumentModel } from '../../../scenario/documents';
import { useCase } from '../../app/context';
import { useGame } from '../../app/store';
import { Amount } from '../../components/Amount';
import { Button, cx, Select, TextInput } from '../../components/ui';
import { NewFindingButton } from '../findings/NewFindingButton';
import { useGedDocuments, useObtained } from '../ged/replies';
import { AmountInput } from './AmountInput';
import { RequestButton } from './RequestControls';

/** Parameters of the firm that can be cited as the source of an assumption. */
const PARAM_SOURCES: readonly { id: string; label: string }[] = [
  { id: 'param:nomenclature', label: 'Nomenclature des composants et durées de l’organisme (politique d’amortissement)' },
  { id: 'param:livret-a', label: 'Taux du Livret A et marges des prêts (mémo technique du cabinet)' },
  { id: 'param:irl', label: 'Variation de l’indice de référence des loyers (mémo technique du cabinet)' },
  { id: 'param:methode-annexe', label: 'Méthode décrite dans l’annexe des comptes' },
  { id: 'param:jugement', label: 'Jugement de l’auditeur, documenté dans la feuille de travail' },
];

/** Cycle of the work programme of each tool (findings created from a gap). */
const TOOL_CYCLE: Readonly<Record<RecalcToolId, string>> = { depreciation: 'fixedAssets', icne: 'debtTreasury', impairment: 'rentReceivables', pge: 'provisions', 'rent-revision': 'rentReceivables', prorata: 'crossCycle' };

/** Request that obtains the client's file of a tool, when it is given on request. */
function sourceRequest(tool: RecalcToolId, scope: string): { family: string; object: string } | null {
  switch (tool) {
    case 'depreciation':
      return { family: 'programme-components', object: scope };
    case 'icne':
      return { family: 'closing-file', object: 'icne' };
    case 'rent-revision':
      return { family: 'closing-file', object: 'rent-revision' };
    default:
      return null;
  }
}

/**
 * Value of an assumption as the rules take it: a percentage typed in the
 * French format (« 2,4 ») becomes a number; a text that is not a number is
 * kept as typed (invalid).
 */
function normalized(def: AssumptionDef | undefined, v: string | number): string | number {
  if (def?.kind !== 'percent' || typeof v === 'number') return v;
  const x = parseDecimal(v);
  return x !== null && Number.isFinite(x) ? x : v;
}

/** Whether two values of an assumption are the same (« 2,4 » is the client's 2.4). */
function sameValue(def: AssumptionDef, a: string | number | undefined, b: string | number | undefined): boolean {
  return String(normalized(def, a ?? '')) === String(normalized(def, b ?? ''));
}

function valueText(def: AssumptionDef, v: string | number): string {
  if (v === '' || v === undefined) return '—';
  switch (def.kind) {
    case 'date':
      return formatDateFr(String(v));
    case 'percent':
      return `${Number(v).toLocaleString('fr-FR', { maximumFractionDigits: 4 })} %`;
    case 'choice':
      return def.choices?.find((c) => c.id === v)?.label ?? String(v);
    case 'component': {
      const [, at] = String(v).split('@');
      return at ? `sortie au ${formatDateFr(at)}` : String(v);
    }
    case 'amount':
      return `${(Number(v) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  }
}

function AssumptionInput({ def, value, onChange, scope, id }: { def: AssumptionDef; value: string | number; onChange: (v: string | number) => void; scope: string; id: string }) {
  const c = useCase();
  const components = useMemo(
    () => (def.kind === 'component' ? c.datasets.components.filter((x) => x.programmeId === scope && x.usefulLifeYears > 0 && x.inServiceDate <= '2025-12-31' && !(x.disposal && x.disposal.date < '2025-01-01')) : []),
    [c, def.kind, scope],
  );
  switch (def.kind) {
    case 'date':
      return <TextInput id={id} type="date" value={String(value)} onChange={(e) => onChange(e.target.value)} className="w-40" />;
    case 'percent':
      return (
        <span className="inline-flex items-center gap-1">
          <TextInput
            id={id}
            inputMode="decimal"
            value={typeof value === 'number' ? value.toLocaleString('fr-FR', { useGrouping: false, maximumFractionDigits: 6 }) : value}
            onChange={(e) => onChange(e.target.value)}
            invalid={typeof normalized(def, value) !== 'number'}
            className="w-24 text-right font-mono"
          />
          <span className="text-sm text-muted">%</span>
        </span>
      );
    case 'choice':
      return (
        <Select id={id} value={String(value)} onChange={(e) => onChange(e.target.value)} className="w-full min-w-0 max-w-[22rem]">
          {def.choices?.map((ch) => (
            <option key={ch.id} value={ch.id}>
              {ch.label}
            </option>
          ))}
        </Select>
      );
    case 'component': {
      const [compId, at] = String(value).includes('@') ? (String(value).split('@') as [string, string]) : ['', ''];
      return (
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          <Select id={id} value={compId} onChange={(e) => onChange(e.target.value ? `${e.target.value}@${at || '2025-12-31'}` : '')} className="w-full min-w-0 max-w-full">
            <option value="">Aucune sortie</option>
            {components.map((x) => (
              <option key={x.id} value={x.id}>
                {x.label} – {x.building} – en service le {formatDateFr(x.inServiceDate)}
              </option>
            ))}
          </Select>
          {compId && <TextInput aria-label="Date de sortie du composant" type="date" value={at} onChange={(e) => onChange(`${compId}@${e.target.value}`)} className="w-40" />}
        </span>
      );
    }
    case 'amount':
      return <AmountInput id={id} cents={value === '' ? null : Number(value)} onCommit={(v) => onChange(v ?? 0)} label={def.label} />;
  }
}

function SourceSelect({ value, onChange, docs, label, id }: { value: string | null; onChange: (v: string | null) => void; docs: readonly DocumentModel[]; label: string; id: string }) {
  return (
    <Select id={id} aria-label={label} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} className={cx('w-full min-w-0 max-w-[22rem] text-xs', !value && 'border-warn')}>
      <option value="">Source à citer…</option>
      <optgroup label="Pièces reçues">
        {docs.map((d) => (
          <option key={d.id} value={`doc:${d.id}`}>
            {d.title}
          </option>
        ))}
      </optgroup>
      <optgroup label="Paramètres du cabinet">
        {PARAM_SOURCES.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </optgroup>
    </Select>
  );
}

function sourceText(source: string | null, byId: (id: string) => DocumentModel | undefined): string {
  if (!source) return 'hypothèse du client';
  if (source.startsWith('doc:')) return byId(source.slice(4).split('#')[0]!)?.title ?? 'pièce';
  return PARAM_SOURCES.find((p) => p.id === source)?.label ?? source;
}

function SavedRecalcs({ executionId, tool, cycle }: { executionId: string | null; tool: RecalcToolId; cycle: string }) {
  const c = useCase();
  const params = c.params;
  const items = useGame((s) => s.game.recalcs.items).filter((x) => x.executionId === executionId && x.tool === tool);
  const { byId } = useGedDocuments();
  const data = { params, world: c.presented, facts: c.facts, doc: () => undefined, obtained: () => false } as RecalcData;
  if (!items.length) return null;
  return (
    <div className="overflow-x-auto rounded-md border border-line">
      <table className="w-full text-sm">
        <caption className="px-2 py-1 text-left text-xs font-semibold uppercase tracking-wide text-muted">Recalculs enregistrés</caption>
        <thead>
          <tr className="border-y border-line text-xs text-muted">
            <th scope="col" className="px-2 py-1 text-left font-medium">
              Date
            </th>
            <th scope="col" className="px-2 py-1 text-left font-medium">
              Périmètre et hypothèses retenues
            </th>
            <th scope="col" className="px-2 py-1 text-right font-medium">
              Calculé
            </th>
            <th scope="col" className="px-2 py-1 text-right font-medium">
              Comptabilisé
            </th>
            <th scope="col" className="px-2 py-1 text-right font-medium">
              Écart
            </th>
            <th scope="col" className="px-2 py-1">
              <span className="sr-only">Constat</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((r) => {
            const scopeLabel = toolScopes(tool, data).find((s) => s.id === r.scope)?.label ?? r.scope;
            const defs = assumptionDefs(tool, r.scope);
            const client = clientAssumptions(params, tool, r.scope);
            const changed = defs.filter((d) => r.assumptions[d.id] && !sameValue(d, r.assumptions[d.id]!.value, client[d.id]));
            const gap = r.summary.computed - r.summary.recorded;
            return (
              <tr key={r.id} className="border-b border-line align-top last:border-b-0">
                <td className="px-2 py-1 font-mono text-xs">{formatDateFr(r.on)}</td>
                <th scope="row" className="px-2 py-1 text-left font-normal">
                  {scopeLabel}
                  {changed.length === 0 ? (
                    <span className="block text-xs text-muted">Hypothèses du client</span>
                  ) : (
                    <ul className="text-xs text-muted">
                      {changed.map((d) => (
                        <li key={d.id}>
                          {d.label} : {valueText(d, r.assumptions[d.id]!.value)} ({sourceText(r.assumptions[d.id]!.source, byId)})
                        </li>
                      ))}
                    </ul>
                  )}
                </th>
                <td className="px-2 py-1 text-right">
                  <Amount cents={r.summary.computed} />
                </td>
                <td className="px-2 py-1 text-right">
                  <Amount cents={r.summary.recorded} />
                </td>
                <td className="px-2 py-1 text-right font-semibold">
                  <Amount cents={gap} />
                </td>
                <td className="px-2 py-1 text-right">
                  {gap !== 0 && (
                    <NewFindingButton
                      compact
                      seed={{
                        cycle,
                        objects: tool === 'depreciation' || (tool === 'rent-revision' && r.scope !== 'all') ? [{ kind: 'programme', id: r.scope }] : tool === 'icne' && r.scope !== 'all' ? [{ kind: 'thirdParty', id: r.scope }] : [],
                        evidence: [{ kind: 'recalc', id: r.id }],
                        amount: Math.abs(gap),
                        label: `${TOOL_DEFS[tool].label} – ${scopeLabel} : écart de recalcul`,
                      }}
                    />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Recalculation of a procedure (or outside any procedure when `executionId` is null). */
export function RecalcTool({ executionId, tool, cycle }: { executionId: string | null; tool: RecalcToolId; cycle?: string }) {
  const c = useCase();
  const params = c.params;
  const act = useGame((s) => s.act);
  const { available, byId } = useGedDocuments();
  const obtained = useObtained();
  const availableIds = useMemo(() => new Set(available.map((d) => d.id)), [available]);
  const sortedDocs = useMemo(() => [...available].sort((a, b) => a.title.localeCompare(b.title, 'fr')), [available]);
  const data: RecalcData = useMemo(() => ({ params, world: c.presented, facts: c.facts, doc: (id) => (availableIds.has(id) ? byId(id) : undefined), obtained }), [params, c, availableIds, byId, obtained]);
  const scopes = useMemo(() => toolScopes(tool, data), [tool, data]);
  const [scope, setScope] = useState<string>(() => scopes.find((s) => toolAccess(tool, s.id, data).ok)?.id ?? scopes[0]?.id ?? '');
  const client = useMemo(() => clientAssumptions(params, tool, scope), [params, tool, scope]);
  const [values, setValues] = useState<Record<string, Record<string, string | number>>>({});
  const [sources, setSources] = useState<Record<string, Record<string, string | null>>>({});
  const [saved, setSaved] = useState<string | null>(null);
  const defs = assumptionDefs(tool, scope);
  // v: as typed (shown in the inputs); vn: as submitted to the rules (percentages typed with a comma normalised)
  const v = { ...client, ...(values[scope] ?? {}) };
  const vn = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, normalized(defs.find((d) => d.id === k), x)]));
  const src = sources[scope] ?? {};
  const assumptions = Object.fromEntries(defs.map((d) => [d.id, { value: vn[d.id] ?? '', source: sameValue(d, v[d.id], client[d.id]) ? null : (src[d.id] ?? null) }]));
  const invalid = defs.filter((d) => d.kind === 'percent' && typeof vn[d.id] !== 'number');
  const unsourced = unsourcedChanges(params, tool, scope, assumptions);
  const access = toolAccess(tool, scope, data);
  const blocked = access.ok ? assumptionBlocked(tool, vn, data) : null;
  const ready = tool === 'prorata' || c.view.ledger2025 === 'draft';
  const outcome = useMemo(() => (ready && access.ok && !blocked && invalid.length === 0 && unsourced.length === 0 ? runRecalc(tool, scope, vn, data) : null), [ready, access.ok, blocked, invalid.length, unsourced.length, tool, scope, JSON.stringify(vn), data]); // eslint-disable-line react-hooks/exhaustive-deps
  const scopeLabel = scopes.find((s) => s.id === scope)?.label ?? scope;
  const idp = `recalc-${executionId ?? 'free'}-${tool}`;
  const req = sourceRequest(tool, scope);

  if (!ready) {
    return <p className="text-sm text-muted">Le recalcul porte sur les comptes de l’exercice : il sera possible avec la balance et le FEC définitifs (attendus le {formatDateFr(vintageDates(params).draftLedger)}).</p>;
  }

  const save = () => {
    if (!outcome) return;
    act((s) => saveRecalc(s, { executionId, tool, scope, assumptions, outcome, title: `${TOOL_DEFS[tool].label} – ${scopeLabel}` }, params));
    setSaved(`Recalcul enregistré (${scopeLabel}).`);
  };

  return (
    <div className="min-w-0 space-y-3">
      <p className="text-sm">
        <span className="font-medium">{TOOL_DEFS[tool].label}</span> <span className="text-muted">– {TOOL_DEFS[tool].description}</span>
      </p>
      {scopes.length > 1 && (
        <label className="block text-sm">
          <span className="block text-xs text-muted">Périmètre</span>
          <Select
            value={scope}
            onChange={(e) => {
              setScope(e.target.value);
              setSaved(null);
            }}
            className="max-w-sm"
          >
            {scopes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
        </label>
      )}
      {!access.ok ? (
        <div className="rounded-md border border-line px-3 py-2 text-sm">
          <p>Le fichier du client n’est pas encore disponible : il faut d’abord obtenir {access.missing}.</p>
          {req && (
            <div className="mt-2">
              <RequestButton family={req.family} object={req.object} label="Demander la pièce" />
            </div>
          )}
        </div>
      ) : (
        <>
          <fieldset className="space-y-2 rounded-md border border-line p-3">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">Hypothèses (celles du client par défaut)</legend>
            {defs.map((d) => {
              const changed = !sameValue(d, v[d.id], client[d.id]);
              const id = `${idp}-${d.id}`;
              return (
                <div key={d.id} className="grid gap-1 sm:grid-cols-[minmax(12rem,18rem)_minmax(0,1fr)] sm:items-start">
                  <label htmlFor={id} className="text-sm">
                    {d.label}
                    {d.help && <span className="block text-xs text-muted">{d.help}</span>}
                  </label>
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <AssumptionInput def={d} value={v[d.id] ?? ''} scope={scope} id={id} onChange={(x) => setValues((o) => ({ ...o, [scope]: { ...(o[scope] ?? {}), [d.id]: x } }))} />
                    {changed && tool !== 'prorata' && (
                      <>
                        <SourceSelect id={`${id}-source`} label={`Source de l’hypothèse : ${d.label}`} value={src[d.id] ?? null} docs={sortedDocs} onChange={(x) => setSources((o) => ({ ...o, [scope]: { ...(o[scope] ?? {}), [d.id]: x } }))} />
                        <Button
                          variant="ghost"
                          className="px-1.5 py-0 text-xs"
                          onClick={() =>
                            setValues((o) => {
                              const next = { ...(o[scope] ?? {}) };
                              delete next[d.id];
                              return { ...o, [scope]: next };
                            })
                          }
                        >
                          Hypothèse du client
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </fieldset>
          {blocked && <p className="text-sm text-warn">{blocked}</p>}
          {invalid.length > 0 && <p className="text-sm text-warn">Saisissez un pourcentage valide, avec une virgule décimale ({invalid.map((d) => d.label).join(', ')}).</p>}
          {unsourced.length > 0 && <p className="text-sm text-warn">Citez la source de chaque hypothèse modifiée (pièce reçue ou paramètre du cabinet) pour obtenir le calcul.</p>}
          {outcome && (
            <div className="overflow-x-auto rounded-md border border-line">
              <table className="w-full text-sm">
                <caption className="sr-only">Résultat du recalcul : montants calculés, comptabilisés et écarts</caption>
                <thead>
                  <tr className="border-b border-line bg-sunken text-xs text-muted">
                    <th scope="col" className="px-2 py-1 text-left font-medium">
                      Poste
                    </th>
                    <th scope="col" className="px-2 py-1 text-right font-medium">
                      Calculé
                    </th>
                    <th scope="col" className="px-2 py-1 text-right font-medium">
                      Comptabilisé
                    </th>
                    <th scope="col" className="px-2 py-1 text-right font-medium">
                      Écart
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {outcome.lines.map((l) => (
                    <tr key={l.label} className="border-b border-line">
                      <th scope="row" className="px-2 py-1 text-left font-normal">
                        {l.label}
                      </th>
                      <td className="px-2 py-1 text-right">
                        <Amount cents={l.computed} decimals={2} />
                      </td>
                      <td className="px-2 py-1 text-right">
                        <Amount cents={l.recorded} decimals={2} />
                      </td>
                      <td className="px-2 py-1 text-right">
                        <Amount cents={l.computed - l.recorded} decimals={2} />
                      </td>
                    </tr>
                  ))}
                  <tr className="font-semibold">
                    <th scope="row" className="px-2 py-1 text-left">
                      Effet sur le résultat (calculé − comptabilisé)
                    </th>
                    <td className="px-2 py-1 text-right">
                      <Amount cents={outcome.computed} decimals={2} />
                    </td>
                    <td className="px-2 py-1 text-right">
                      <Amount cents={outcome.recorded} decimals={2} />
                    </td>
                    <td className="px-2 py-1 text-right">
                      <Amount cents={outcome.gap} decimals={2} />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          {outcome && tool === 'depreciation' && <p className="text-xs text-muted">La quote-part des subventions virée au résultat vient en déduction des charges dans l’effet sur le résultat.</p>}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" disabled={!outcome} onClick={save}>
              Enregistrer le recalcul
            </Button>
            <span aria-live="polite" className="text-sm text-ok">
              {saved}
            </span>
            {executionId === null && <span className="text-xs text-muted">Hors procédure, un recalcul coûte {params.sampling.recalcHours.toLocaleString('fr-FR')} h.</span>}
          </div>
        </>
      )}
      <SavedRecalcs executionId={executionId} tool={tool} cycle={cycle ?? TOOL_CYCLE[tool]} />
    </div>
  );
}
