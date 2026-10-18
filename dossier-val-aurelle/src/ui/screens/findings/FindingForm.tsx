/**
 * Finding form (plan J4 §13.1): cycle, objects (three at most, closed lists),
 * natures (two at most), classification, treatments, proposed correction
 * entry (balanced lines on accounts of the chart; amounts typed in euros) or
 * disclosure fix, typed evidence, status with its dated history, escalation
 * to the partner, free comment. The impacts are derived from the entry with
 * the code of the key (result, equity, CAF, net self-financing), never typed.
 * The draft lives in the form: the game state changes only on « Enregistrer ».
 */
import { useId, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import { formatDateFr } from '../../../engine/dates';
import { blockText } from '../../../game/documents';
import {
  createFinding,
  deleteFinding,
  draftErrors,
  draftWarnings,
  entryTotals,
  escalateFinding,
  evidenceKey,
  FINDING_CLASSIFICATIONS,
  FINDING_NATURES,
  FINDING_OBJECT_KINDS,
  FINDING_STATUSES,
  FINDING_TREATMENTS,
  meaningfulLines,
  updateFinding,
  type Evidence,
  type FindingDraft,
  type FindingObjectKind,
  type ProposedLine,
} from '../../../game/findings';
import { presentedFigures } from '../../../game/misstatements';
import { impactOfLines } from '../../../scenario/anomalies/presented';
import { useCase } from '../../app/context';
import { useGame } from '../../app/store';
import { Amount } from '../../components/Amount';
import { Badge, Button, Checkbox, cx, Select, TextInput } from '../../components/ui';
import { entryIdsByNumber } from '../fec/entryKey';
import { AmountInput } from '../tools/AmountInput';
import { useEvidenceOptions, useEvidenceView, useFindingCatalog } from './catalog';
import { CLASSIFICATION_LABELS, EVIDENCE_KIND_LABELS, NATURE_LABELS, OBJECT_KIND_LABELS, STATUS_HELP, STATUS_LABELS, STATUS_TONES, TREATMENT_LABELS, type EvidenceKind } from './labels';

export interface FindingFormProps {
  /** Finding being edited (absent: a new finding). */
  findingId?: string;
  initial: FindingDraft;
  /** Context of the creation (label of the button that opened the form). */
  context?: string;
  /** Called after saving (with the id), deleting or cancelling (null). */
  onDone: (id: string | null) => void;
  /** Hide the « Annuler » button (side panel of the screen). */
  hideCancel?: boolean;
}

function Section({ title, children, hint }: { title: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <fieldset className="min-w-0 rounded-md border border-line px-3 pb-3 pt-1">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">{title}</legend>
      {hint && <p className="mb-2 text-xs text-muted">{hint}</p>}
      {children}
    </fieldset>
  );
}

function excerpt(text: string, n = 60): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

const EMPTY_LINE: ProposedLine = { account: '', debit: 0, credit: 0 };

export function FindingForm({ findingId, initial, context, onDone, hideCancel }: FindingFormProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const c = useCase();
  const params = c.params;
  const act = useGame((s) => s.act);
  const date = useGame((s) => s.game.clock.date);
  const saved = useGame((s) => (findingId ? s.game.findings.items.find((f) => f.id === findingId) : undefined));
  const catalog = useFindingCatalog();
  const evidenceView = useEvidenceView();
  const [d, setD] = useState<FindingDraft>(() => ({ ...initial, proposedEntry: initial.proposedEntry.length ? initial.proposedEntry : [EMPTY_LINE, EMPTY_LINE] }));
  const [tried, setTried] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (changes: Partial<FindingDraft>) => setD((x) => ({ ...x, ...changes }));
  const m = params.disclosureItems.matching;

  const errors = useMemo(() => draftErrors(d, { params, accounts: catalog.accounts }), [d, params, catalog.accounts]);
  const warnings = useMemo(() => draftWarnings(d), [d]);
  const lines = useMemo(() => meaningfulLines(d.proposedEntry), [d.proposedEntry]);
  const totals = entryTotals(lines);
  const impact = useMemo(() => (lines.length >= 2 && totals.balanced && lines.every((l) => catalog.accounts.has(l.account)) ? impactOfLines(presentedFigures(c.presented, params), lines, { world: c.presented, params }) : null), [lines, totals.balanced, catalog.accounts, c, params]);
  const fixes = params.disclosureItems.fixes.filter((f) => f.treatments.some((t) => d.treatments.includes(t)));

  const save = (e?: FormEvent) => {
    e?.preventDefault();
    setTried(true);
    if (errors.length) return;
    if (findingId) {
      act((s) => updateFinding(s, findingId, d, params));
      onDone(findingId);
    } else {
      act((s) => createFinding(s, d, params)[0]);
      onDone(useGame.getState().game.findings.items.at(-1)?.id ?? null);
    }
  };

  const toggle = <T extends string>(list: readonly T[], v: T, max?: number): T[] => (list.includes(v) ? list.filter((x) => x !== v) : max !== undefined && list.length >= max ? [...list] : [...list, v]);

  return (
    <form onSubmit={save} aria-label={findingId ? `Constat ${findingId}` : 'Nouveau constat'} className="space-y-3 text-sm" noValidate>
      {context && (
        <p className="rounded-md border border-line bg-sunken px-3 py-2 text-xs">
          <span className="font-medium">Contexte : </span>
          {context}
          {d.contextAmount !== undefined && (
            <>
              {' '}
              – montant relevé <Amount cents={d.contextAmount} decimals={2} /> €
            </>
          )}
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <div className="min-w-0 space-y-2">
          <div>
            <label htmlFor={`${uid}-title`} className="mb-0.5 block text-xs text-muted">
              Intitulé
            </label>
            <TextInput id={`${uid}-title`} value={d.title} onChange={(e) => set({ title: e.target.value })} placeholder="Intitulé court du constat" className="w-full" maxLength={160} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor={`${uid}-status`} className="mb-0.5 block text-xs text-muted">
                Statut
              </label>
              <Select id={`${uid}-status`} value={d.status} onChange={(e) => set({ status: e.target.value as FindingDraft['status'] })} className="w-full" aria-describedby={`${uid}-status-help`}>
                {FINDING_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label htmlFor={`${uid}-cycle`} className="mb-0.5 block text-xs text-muted">
                Cycle
              </label>
              <Select id={`${uid}-cycle`} value={d.cycle} onChange={(e) => set({ cycle: e.target.value })} className="w-full">
                {params.cycles.cycles.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <p id={`${uid}-status-help`} className="text-xs text-muted">
            {STATUS_HELP[d.status]}
          </p>
        </div>
        <Section title="Classification">
          <div role="radiogroup" aria-label="Classification" className="flex flex-wrap gap-x-4 gap-y-1">
            {FINDING_CLASSIFICATIONS.map((k) => (
              <label key={k} className="inline-flex cursor-pointer items-center gap-1.5">
                <input type="radio" name={`${uid}-classification`} value={k} checked={d.classification === k} onChange={() => set({ classification: k })} className="accent-[var(--accent)]" />
                {CLASSIFICATION_LABELS[k]}
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">Natures ({m.maxNatures} au plus)</p>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {FINDING_NATURES.map((n) => (
              <Checkbox key={n} id={`${uid}-nature-${n}`} label={NATURE_LABELS[n]} checked={d.natures.includes(n)} onChange={() => set({ natures: toggle(d.natures, n, m.maxNatures) })} />
            ))}
          </div>
        </Section>
      </div>

      <ObjectsSection uid={uid} objects={d.objects} max={m.maxObjects} onChange={(objects) => set({ objects })} />

      <Section title="Traitement proposé">
        <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
          {FINDING_TREATMENTS.map((t) => (
            <Checkbox key={t} id={`${uid}-treatment-${t}`} label={TREATMENT_LABELS[t]} checked={d.treatments.includes(t)} onChange={() => {
              const treatments = toggle(d.treatments, t);
              const fix = d.disclosureFix && params.disclosureItems.fixes.find((f) => f.id === d.disclosureFix)?.treatments.some((x) => treatments.includes(x)) ? d.disclosureFix : null;
              set({ treatments, disclosureFix: fix });
            }} />
          ))}
        </div>
        <div className="mt-2">
          <label htmlFor={`${uid}-fix`} className="mb-0.5 block text-xs text-muted">
            Correction d’information (annexe, rapport de gestion, rapport spécial, gouvernance)
          </label>
          <Select id={`${uid}-fix`} value={d.disclosureFix ?? ''} onChange={(e) => set({ disclosureFix: e.target.value || null })} className="w-full" disabled={fixes.length === 0}>
            <option value="">{fixes.length === 0 ? 'Choisissez d’abord un traitement d’information' : 'Aucune'}</option>
            {fixes.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </Select>
        </div>
      </Section>

      <EntrySection uid={uid} lines={d.proposedEntry} contextAmount={d.contextAmount} onChange={(proposedEntry) => set({ proposedEntry })} />
      {impact && (
        <div className="rounded-md border border-line bg-sunken px-3 py-2" aria-live="polite">
          <p className="text-xs font-semibold">Impacts de l’écriture proposée (surévaluation du chiffre présenté : +)</p>
          <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs sm:grid-cols-4">
            {(
              [
                ['Résultat', impact.result],
                ['Capitaux propres', impact.equity],
                ['CAF', impact.caf],
                ['Autofinancement net', impact.netSelfFinancing],
              ] as const
            ).map(([label, v]) => (
              <div key={label}>
                <dt className="text-muted">{label}</dt>
                <dd>
                  <Amount cents={v} decimals={2} />
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <EvidenceSection uid={uid} evidence={d.evidence} onChange={(evidence) => set({ evidence })} />

      <div>
        <label htmlFor={`${uid}-comment`} className="mb-0.5 block text-xs text-muted">
          Commentaire (libre)
        </label>
        <textarea id={`${uid}-comment`} value={d.comment} onChange={(e) => set({ comment: e.target.value })} rows={3} className="w-full resize-y rounded-md border border-line bg-panel px-2 py-1 text-sm" />
      </div>

      {saved && (
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-line px-3 py-2 text-xs">
          <div>
            <p className="font-semibold">Historique</p>
            <ol className="mt-0.5 space-y-0.5">
              {saved.history.map((h, i) => (
                <li key={i}>
                  <span className="font-mono">{formatDateFr(h.on)}</span> – <Badge tone={STATUS_TONES[h.status]}>{STATUS_LABELS[h.status]}</Badge>
                </li>
              ))}
            </ol>
            <p className="mt-1 text-muted">Créé le {formatDateFr(saved.createdOn)}{saved.updatedOn ? `, modifié le ${formatDateFr(saved.updatedOn)}` : ''}.</p>
          </div>
          <div className="text-right">
            {saved.escalatedToPartnerOn ? (
              <Badge tone="accent">Remonté à l’associée le {formatDateFr(saved.escalatedToPartnerOn)}</Badge>
            ) : (
              <Button onClick={() => act((s) => escalateFinding(s, saved.id))} title={`Porter le constat à la connaissance de l’associée (daté du ${formatDateFr(date)})`}>
                Remonter à l’associée
              </Button>
            )}
          </div>
        </div>
      )}

      {tried && errors.length > 0 && (
        <ul role="alert" className="list-disc space-y-0.5 rounded-md border border-ko/40 bg-ko/10 py-2 pl-7 pr-3 text-xs text-ko">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      {warnings.length > 0 && (
        <ul className="list-disc space-y-0.5 rounded-md border border-warn/40 bg-warn/10 py-2 pl-7 pr-3 text-xs text-warn">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-3">
        {saved &&
          (confirmDelete ? (
            <>
              <span className="mr-auto text-xs text-ko">Supprimer définitivement le constat {saved.id} ?</span>
              <Button variant="danger" onClick={() => { act((s) => deleteFinding(s, saved.id)); onDone(null); }}>
                Confirmer la suppression
              </Button>
              <Button onClick={() => setConfirmDelete(false)}>Garder</Button>
            </>
          ) : (
            <Button variant="ghost" className="mr-auto text-ko" onClick={() => setConfirmDelete(true)}>
              Supprimer…
            </Button>
          ))}
        {!hideCancel && <Button onClick={() => onDone(null)}>Annuler</Button>}
        <Button type="submit" variant="primary">
          {findingId ? 'Enregistrer les modifications' : d.status === 'question' ? 'Enregistrer la question' : 'Enregistrer le constat'}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// objects
// ---------------------------------------------------------------------------

function ObjectsSection({ uid, objects, max, onChange }: { uid: string; objects: FindingDraft['objects']; max: number; onChange: (o: FindingDraft['objects']) => void }) {
  const catalog = useFindingCatalog();
  const [kind, setKind] = useState<FindingObjectKind>('programme');
  const [id, setId] = useState('');
  const options = catalog.options[kind];
  const full = objects.length >= max;
  const add = () => {
    if (!id || full || objects.some((o) => o.kind === kind && o.id === id)) return;
    onChange([...objects, { kind, id }]);
    setId('');
  };
  return (
    <Section title={`Objets (${max} au plus)`} hint="Programme, tiers, compte, pièce, emprunt, subvention ou information de l’annexe et du rapport de gestion concernés.">
      {objects.length > 0 ? (
        <ul className="mb-2 flex flex-wrap gap-1.5" aria-label="Objets du constat">
          {objects.map((o) => (
            <li key={`${o.kind}:${o.id}`} className="inline-flex max-w-full items-center gap-1 rounded border border-line bg-sunken px-1.5 py-0.5 text-xs">
              <span className="text-muted">{OBJECT_KIND_LABELS[o.kind].split(' (')[0]} :</span>
              <span className="truncate">{catalog.objectLabel(o)}</span>
              <button type="button" className="ml-0.5 rounded px-1 text-muted hover:bg-panel hover:text-ink" aria-label={`Retirer l’objet ${catalog.objectLabel(o)}`} onClick={() => onChange(objects.filter((x) => x !== o))}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-2 text-xs text-muted">Aucun objet.</p>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor={`${uid}-obj-kind`} className="mb-0.5 block text-xs text-muted">
            Genre
          </label>
          <Select id={`${uid}-obj-kind`} value={kind} onChange={(e) => { setKind(e.target.value as FindingObjectKind); setId(''); }} disabled={full} className="w-40">
            {FINDING_OBJECT_KINDS.map((k) => (
              <option key={k} value={k}>
                {OBJECT_KIND_LABELS[k]}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-[12rem] flex-1">
          <label htmlFor={`${uid}-obj-id`} className="mb-0.5 block text-xs text-muted">
            Objet
          </label>
          <Select id={`${uid}-obj-id`} value={id} onChange={(e) => setId(e.target.value)} className="w-full" disabled={full}>
            <option value="">Choisir…</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        <Button onClick={add} disabled={!id || full}>
          Ajouter l’objet
        </Button>
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// proposed entry
// ---------------------------------------------------------------------------

function EntrySection({ uid, lines, contextAmount, onChange }: { uid: string; lines: ProposedLine[]; contextAmount?: number | undefined; onChange: (l: ProposedLine[]) => void }) {
  const catalog = useFindingCatalog();
  const totals = entryTotals(lines);
  const setLine = (i: number, changes: Partial<ProposedLine>) => onChange(lines.map((l, k) => (k === i ? { ...l, ...changes } : l)));
  const filled = meaningfulLines(lines).length > 0;
  return (
    <Section title="Écriture de correction proposée" hint="Lignes équilibrées sur les comptes du plan ; les impacts en sont déduits. Laissez vide pour un constat d’information.">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-xs">
          <caption className="sr-only">Lignes de l’écriture proposée</caption>
          <thead className="text-muted">
            <tr>
              <th scope="col" className="py-1 pr-2 text-left font-semibold">Compte</th>
              <th scope="col" className="px-2 py-1 text-right font-semibold">Débit (€)</th>
              <th scope="col" className="px-2 py-1 text-right font-semibold">Crédit (€)</th>
              <th scope="col" className="py-1 pl-2"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-t border-line">
                <td className="py-1 pr-2">
                  <Select aria-label={`Compte de la ligne ${i + 1}`} value={l.account} onChange={(e) => setLine(i, { account: e.target.value })} className="w-full max-w-[24rem] py-0.5 text-xs">
                    <option value="">Choisir un compte…</option>
                    {catalog.options.account.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label}
                      </option>
                    ))}
                  </Select>
                </td>
                <td className="px-2 py-1 text-right">
                  <AmountInput id={`${uid}-d${i}`} label={`Débit de la ligne ${i + 1}`} cents={l.debit || null} onCommit={(v) => setLine(i, { debit: Math.max(0, v ?? 0), ...(v ? { credit: 0 } : {}) })} className="w-32 py-0.5 text-right font-mono text-xs" />
                </td>
                <td className="px-2 py-1 text-right">
                  <AmountInput id={`${uid}-c${i}`} label={`Crédit de la ligne ${i + 1}`} cents={l.credit || null} onCommit={(v) => setLine(i, { credit: Math.max(0, v ?? 0), ...(v ? { debit: 0 } : {}) })} className="w-32 py-0.5 text-right font-mono text-xs" />
                </td>
                <td className="py-1 pl-2 text-right">
                  <Button variant="ghost" className="px-1.5 py-0 text-xs" aria-label={`Retirer la ligne ${i + 1}`} onClick={() => onChange(lines.filter((_, k) => k !== i))} disabled={lines.length <= 1}>
                    ✕
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-line font-semibold">
              <th scope="row" className="py-1 pr-2 text-left">
                Total {filled && (totals.balanced ? <Badge tone="ok">Équilibrée</Badge> : <Badge tone="ko">Déséquilibrée</Badge>)}
              </th>
              <td className="px-2 py-1 text-right">
                <Amount cents={totals.debit} decimals={2} />
              </td>
              <td className="px-2 py-1 text-right">
                <Amount cents={totals.credit} decimals={2} />
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button className="text-xs" onClick={() => onChange([...lines, EMPTY_LINE])}>
          Ajouter une ligne
        </Button>
        {contextAmount !== undefined && !filled && (
          <Button className="text-xs" onClick={() => onChange([{ ...(lines[0] ?? EMPTY_LINE), debit: contextAmount, credit: 0 }, { ...(lines[1] ?? EMPTY_LINE), debit: 0, credit: contextAmount }, ...lines.slice(2)])}>
            Reprendre le montant relevé
          </Button>
        )}
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// evidence
// ---------------------------------------------------------------------------

const EVIDENCE_KINDS: readonly EvidenceKind[] = ['doc', 'fec', 'sample', 'recalc', 'query', 'execution', 'confirmation'];

function EvidenceSection({ uid, evidence, onChange }: { uid: string; evidence: Evidence[]; onChange: (e: Evidence[]) => void }) {
  const c = useCase();
  const catalog = useFindingCatalog();
  const view = useEvidenceView();
  const others = useEvidenceOptions();
  const [kind, setKind] = useState<EvidenceKind>('doc');
  const [docId, setDocId] = useState('');
  const [block, setBlock] = useState('');
  const [year, setYear] = useState<number>(c.params.scenario.years.current);
  const [num, setNum] = useState('');
  const [other, setOther] = useState('');
  const [error, setError] = useState<string | null>(null);
  const doc = docId ? catalog.documents.find((x) => x.id === docId) : undefined;

  const add = () => {
    let ev: Evidence | null = null;
    if (kind === 'doc') ev = docId ? (block === '' ? { kind: 'doc', docId } : { kind: 'doc', docId, block: Number(block) }) : null;
    else if (kind === 'fec') {
      const n = num.trim().toUpperCase();
      if (!n) return;
      const known = year === c.params.scenario.years.current || year === c.params.scenario.years.prior ? entryIdsByNumber(c.fecIndex(year as 2024 | 2025)).has(n) : false;
      if (!known) {
        setError(`Écriture ${n} introuvable dans le FEC ${year} disponible à la date du dossier.`);
        return;
      }
      ev = { kind: 'fec', year, num: n };
    } else ev = other ? { kind, id: other } : null;
    if (!ev) return;
    setError(null);
    if (!evidence.some((x) => evidenceKey(x) === evidenceKey(ev))) onChange([...evidence, ev]);
    setDocId('');
    setBlock('');
    setNum('');
    setOther('');
  };

  return (
    <Section title="Pièces liées" hint="Éléments probants typés : pièce (et passage), écriture du FEC par son numéro, échantillon, recalcul, requête, feuille de travail, confirmation.">
      {evidence.length > 0 ? (
        <ul className="mb-2 space-y-1" aria-label="Pièces liées au constat">
          {evidence.map((e) => {
            const v = view(e);
            return (
              <li key={evidenceKey(e)} className="flex items-start justify-between gap-2 rounded border border-line px-2 py-1 text-xs">
                <span className="min-w-0">
                  <span className="text-muted">{EVIDENCE_KIND_LABELS[e.kind]} : </span>
                  {v.to ? (
                    <Link to={v.to} className="text-accent underline-offset-2 hover:underline">
                      {v.label}
                    </Link>
                  ) : (
                    v.label
                  )}
                </span>
                <button type="button" className="rounded px-1 text-muted hover:bg-sunken hover:text-ink" aria-label={`Retirer la pièce ${v.label}`} onClick={() => onChange(evidence.filter((x) => x !== e))}>
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mb-2 text-xs text-muted">Aucune pièce liée.</p>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor={`${uid}-ev-kind`} className="mb-0.5 block text-xs text-muted">
            Type
          </label>
          <Select id={`${uid}-ev-kind`} value={kind} onChange={(e) => { setKind(e.target.value as EvidenceKind); setOther(''); setError(null); }} className="w-40">
            {EVIDENCE_KINDS.map((k) => (
              <option key={k} value={k}>
                {EVIDENCE_KIND_LABELS[k]}
              </option>
            ))}
          </Select>
        </div>
        {kind === 'doc' && (
          <>
            <div className="min-w-[12rem] flex-[2]">
              <label htmlFor={`${uid}-ev-doc`} className="mb-0.5 block text-xs text-muted">
                Pièce
              </label>
              <Select id={`${uid}-ev-doc`} value={docId} onChange={(e) => { setDocId(e.target.value); setBlock(''); }} className="w-full">
                <option value="">Choisir une pièce reçue…</option>
                {catalog.documents.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.title}
                  </option>
                ))}
              </Select>
            </div>
            <div className="min-w-[10rem] flex-1">
              <label htmlFor={`${uid}-ev-block`} className="mb-0.5 block text-xs text-muted">
                Passage
              </label>
              <Select id={`${uid}-ev-block`} value={block} onChange={(e) => setBlock(e.target.value)} className="w-full" disabled={!doc}>
                <option value="">Pièce entière</option>
                {doc?.blocks.map((b, i) => (
                  <option key={i} value={i}>
                    Bloc {i + 1} – {excerpt(blockText(b))}
                  </option>
                ))}
              </Select>
            </div>
          </>
        )}
        {kind === 'fec' && (
          <>
            <div>
              <label htmlFor={`${uid}-ev-year`} className="mb-0.5 block text-xs text-muted">
                Exercice
              </label>
              <Select id={`${uid}-ev-year`} value={String(year)} onChange={(e) => setYear(Number(e.target.value))}>
                {[c.params.scenario.years.current, c.params.scenario.years.prior].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label htmlFor={`${uid}-ev-num`} className="mb-0.5 block text-xs text-muted">
                Numéro d’écriture (EcritureNum)
              </label>
              <TextInput id={`${uid}-ev-num`} value={num} onChange={(e) => setNum(e.target.value)} placeholder="ex. OD000012" className="w-36 font-mono" invalid={!!error} aria-describedby={error ? `${uid}-ev-error` : undefined} />
            </div>
          </>
        )}
        {kind !== 'doc' && kind !== 'fec' && (
          <div className="min-w-[12rem] flex-1">
            <label htmlFor={`${uid}-ev-other`} className="mb-0.5 block text-xs text-muted">
              {EVIDENCE_KIND_LABELS[kind]}
            </label>
            <Select id={`${uid}-ev-other`} value={other} onChange={(e) => setOther(e.target.value)} className="w-full" disabled={others[kind].length === 0}>
              <option value="">{others[kind].length === 0 ? 'Aucun élément de ce type pour l’instant' : 'Choisir…'}</option>
              {others[kind].map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
        )}
        <Button onClick={add} disabled={kind === 'doc' ? !docId : kind === 'fec' ? !num.trim() : !other}>
          Lier
        </Button>
      </div>
      {error && (
        <p id={`${uid}-ev-error`} role="alert" className={cx('mt-1 text-xs text-ko')}>
          {error}
        </p>
      )}
    </Section>
  );
}
