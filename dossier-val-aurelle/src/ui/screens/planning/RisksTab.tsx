/**
 * Planification – Risques (NEP 315, 240, 250, 330; plan J4 §6.2): matrix by
 * cycle (moderate by default, detail by assertion optional, justification for
 * high and significant risks), significant accounts against the planning
 * materiality, fraud presumption by type of revenue, management override
 * (always retained), laws and regulations, risk factors captured from the
 * documents, and the coverage of the risks by the programme.
 */
import { Fragment, useMemo, useState } from 'react';
import { useGedDocuments } from '../ged/replies';
import { Link } from 'react-router';
import { formatDateFr } from '../../../engine/dates';
import { formatEuro } from '../../../engine/format';
import { blockText } from '../../../game/documents';
import {
  captureRiskFactor,
  clearRisk,
  coverage,
  deleteRiskFactor,
  fraudRetained,
  needsJustification,
  planningThreshold,
  riskErrors,
  riskLevelOf,
  setFraudPresumption,
  setRisk,
  significantAccounts,
  toggleLaw,
  validateRisks,
  type RiskLevel,
} from '../../../game/planning';
import { procedureDef } from '../../../game/program';
import { RISK_LEVELS } from '../../../scenario/schemas/planning';
import { useCase } from '../../app/context';
import { useGame } from '../../app/store';
import { Badge, Button, Card, Checkbox, cx, Select, TextInput } from '../../components/ui';
import { Field } from './Field';
import { assertionLabel, cycleLabel, RISK_TONE, riskLevelLabel } from './labels';

function excerpt(text: string, n = 70): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

/** One level select and its justification, committed on change (level) or on blur (text): no action per keystroke. */
function RiskEditor({ cycle, assertion, label }: { cycle: string; assertion: string | null; label: string }) {
  const c = useCase();
  const params = c.params;
  const planning = useGame((s) => s.game.planning);
  const act = useGame((s) => s.act);
  const key = assertion ? `${cycle}:${assertion}` : cycle;
  const entry = planning.risks[key];
  const level = assertion && !entry ? 'inherit' : riskLevelOf(planning, cycle, assertion);
  const [text, setText] = useState(entry?.justification ?? '');
  const required = level !== 'inherit' && needsJustification(params, level);
  const commit = (lv: RiskLevel | 'inherit', j: string) => {
    if (lv === 'inherit') act((s) => clearRisk(s, key, params));
    else act((s) => setRisk(s, cycle, assertion, lv, j, params));
  };
  return (
    <>
      <td className="px-2 py-1">
        <Select aria-label={`Niveau de risque – ${label}`} value={level} onChange={(e) => commit(e.target.value as RiskLevel | 'inherit', text)} className="w-full py-0.5">
          {assertion && <option value="inherit">Niveau du cycle</option>}
          {RISK_LEVELS.map((l) => (
            <option key={l} value={l}>
              {riskLevelLabel(params, l)}
            </option>
          ))}
        </Select>
      </td>
      <td className="px-2 py-1">
        <TextInput
          aria-label={`Justification – ${label}`}
          value={text}
          disabled={level === 'inherit'}
          placeholder={required ? 'Justification requise' : 'Justification (facultative)'}
          invalid={required && !text.trim()}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => level !== 'inherit' && text.trim() !== (entry?.justification ?? '') && commit(level, text)}
          className="w-full py-0.5"
        />
      </td>
      <td className="px-2 py-1 text-xs whitespace-nowrap text-muted">{entry ? formatDateFr(entry.on) : '–'}</td>
    </>
  );
}

function RiskMatrix() {
  const c = useCase();
  const params = c.params;
  const planning = useGame((s) => s.game.planning);
  const [open, setOpen] = useState<Set<string>>(() => new Set(Object.keys(planning.risks).filter((k) => k.includes(':')).map((k) => k.split(':')[0]!)));
  const threshold = planningThreshold(planning);
  const balances = c.view.ledger2025 === 'none' ? c.balances().prior : c.balances().current;
  const significant = useMemo(() => (threshold === null ? null : new Map(significantAccounts(balances, params.cycles.cycles, threshold).map((x) => [x.cycle, x.accounts]))), [balances, params, threshold]);
  const toggle = (id: string) =>
    setOpen((o) => {
      const n = new Set(o);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  return (
    <Card title="Matrice des risques par cycle" actions={<span className="text-xs text-muted">Par défaut, chaque cycle est évalué « modéré ».</span>}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Niveau de risque d’anomalies significatives par cycle et, si besoin, par assertion</caption>
          <thead>
            <tr className="border-b border-line text-xs text-muted">
              <th scope="col" className="px-2 py-1.5 text-left font-medium">
                Cycle
              </th>
              <th scope="col" className="px-2 py-1.5 text-right font-medium" title="Comptes dont le solde atteint le seuil de planification, sur les données disponibles">
                Comptes significatifs
              </th>
              <th scope="col" className="w-44 px-2 py-1.5 text-left font-medium">
                Niveau
              </th>
              <th scope="col" className="px-2 py-1.5 text-left font-medium">
                Justification
              </th>
              <th scope="col" className="px-2 py-1.5 text-left font-medium">
                Révisé le
              </th>
            </tr>
          </thead>
          <tbody>
            {params.cycles.cycles.map((cy) => {
              const sig = significant?.get(cy.id);
              const isOpen = open.has(cy.id);
              return [
                <tr key={cy.id} className="border-b border-line">
                  <th scope="row" className="px-2 py-1 text-left font-normal">
                    <button type="button" aria-expanded={isOpen} onClick={() => toggle(cy.id)} className="inline-flex items-center gap-1 text-left hover:text-accent" title="Détailler par assertion et voir les comptes significatifs">
                      <span aria-hidden className="w-3 text-xs text-muted">
                        {isOpen ? '▾' : '▸'}
                      </span>
                      <span className="font-medium">{cy.label}</span>
                      <span className="sr-only">{isOpen ? ' (masquer le détail)' : ' (détailler par assertion et voir les comptes significatifs)'}</span>
                    </button>
                  </th>
                  <td className="px-2 py-1 text-right">
                    {sig === undefined ? <span className="text-xs text-muted">{threshold === null ? 'seuil à fixer' : '–'}</span> : sig.length}
                  </td>
                  <RiskEditor cycle={cy.id} assertion={null} label={cy.label} />
                </tr>,
                ...(isOpen && sig && sig.length > 0
                  ? [
                      <tr key={`${cy.id}:sig`} className="border-b border-line bg-sunken/50">
                        <td colSpan={5} className="py-1 pl-8 pr-2 text-xs text-muted">
                          Comptes dont le solde atteint le seuil de planification :{' '}
                          {sig.map((a, i) => (
                            <Fragment key={a.account}>
                              {i > 0 && ' · '}
                              <span className="whitespace-nowrap">
                                {a.account} {c.accountLabel(a.account)} <span className="num">{formatEuro(a.balance, 0)}</span>
                              </span>
                            </Fragment>
                          ))}
                        </td>
                      </tr>,
                    ]
                  : []),
                ...(isOpen
                  ? params.planning.assertions.map((a) => (
                      <tr key={`${cy.id}:${a.id}`} className="border-b border-line bg-sunken/50">
                        <th scope="row" className="py-1 pl-8 pr-2 text-left text-xs font-normal text-muted">
                          {a.label}
                        </th>
                        <td />
                        <RiskEditor cycle={cy.id} assertion={a.id} label={`${cy.label} – ${a.label}`} />
                      </tr>
                    ))
                  : []),
              ];
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function FraudPresumption() {
  const c = useCase();
  const params = c.params;
  const planning = useGame((s) => s.game.planning);
  const act = useGame((s) => s.act);
  return (
    <Card title="Présomption de fraude dans la comptabilisation des produits">
      <ul className="divide-y divide-line text-sm">
        {params.planning.revenueTypes.map((r) => (
          <FraudRow key={r.id} id={r.id} label={r.label} description={r.description} retained={fraudRetained(planning, r.id)} justification={planning.fraudPresumption[r.id]?.justification ?? ''} onChange={(retained, j) => act((s) => setFraudPresumption(s, r.id, retained, j, params))} />
        ))}
      </ul>
      <p className="border-t border-line px-3 py-2 text-xs text-muted">La présomption s’applique à chaque type de produits ; elle ne peut être réfutée que par une justification documentée (formulation de la norme à vérifier).</p>
    </Card>
  );
}

function FraudRow({ id, label, description, retained, justification, onChange }: { id: string; label: string; description: string; retained: boolean; justification: string; onChange: (retained: boolean, j: string) => void }) {
  const [text, setText] = useState(justification);
  return (
    <li className="grid gap-2 px-3 py-2 md:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0">
        <p className="font-medium">{label}</p>
        <p className="text-xs text-muted">{description}</p>
        {!retained && (
          <TextInput aria-label={`Justification de la réfutation – ${label}`} value={text} placeholder="Justification requise" invalid={!text.trim()} onChange={(e) => setText(e.target.value)} onBlur={() => text.trim() !== justification && onChange(false, text)} className="mt-1 w-full py-0.5" />
        )}
      </div>
      <fieldset className="flex items-start gap-3 text-sm">
        <legend className="sr-only">Présomption de fraude – {label}</legend>
        <label className="inline-flex items-center gap-1">
          <input type="radio" name={`fraud-${id}`} checked={retained} onChange={() => onChange(true, text)} className="accent-[var(--accent)]" />
          Retenue
        </label>
        <label className="inline-flex items-center gap-1">
          <input type="radio" name={`fraud-${id}`} checked={!retained} onChange={() => onChange(false, text)} className="accent-[var(--accent)]" />
          Réfutée
        </label>
      </fieldset>
    </li>
  );
}

function OverrideAndLaws() {
  const c = useCase();
  const params = c.params;
  const planning = useGame((s) => s.game.planning);
  const planned = useGame((s) => s.game.program.planned);
  const act = useGame((s) => s.act);
  return (
    <div className="space-y-4">
      <Card title="Contournement des contrôles par la direction" actions={<Badge tone="warn">Toujours retenu</Badge>}>
        <div className="px-3 py-2 text-sm">
          <p className="text-muted">Ce risque est présumé dans toute entité. Ses réponses obligatoires sont ajoutées au programme à la validation des risques :</p>
          <ul className="mt-1 space-y-0.5">
            {params.planning.overrideResponses.map((id) => {
              const inProgramme = planned.some((p) => p.procedureId === id);
              return (
                <li key={id} className="flex items-center gap-2">
                  <span aria-hidden className={inProgramme ? 'text-ok' : 'text-muted'}>
                    {inProgramme ? '☑' : '☐'}
                  </span>
                  {procedureDef(params, id)?.title ?? id}
                  <span className="sr-only">{inProgramme ? ' (au programme)' : ' (pas encore au programme)'}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </Card>
      <Card title="Lois et règlements ayant une incidence sur les comptes">
        <ul className="space-y-1.5 px-3 py-2 text-sm">
          {params.planning.lawsRegulations.map((l) => (
            <li key={l.id}>
              <Checkbox id={`law-${l.id}`} label={<span className="font-medium">{l.label}</span>} checked={planning.laws.includes(l.id)} onChange={() => act((s) => toggleLaw(s, l.id, params))} />
              <p className="pl-6 text-xs text-muted">{l.description}</p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function RiskFactors() {
  const c = useCase();
  const params = c.params;
  const factors = useGame((s) => s.game.planning.riskFactors);
  const act = useGame((s) => s.act);
  const docs = useGedDocuments().available;
  const sorted = useMemo(() => [...docs].sort((a, b) => a.title.localeCompare(b.title, 'fr')), [docs]);
  const [docId, setDocId] = useState('');
  const [block, setBlock] = useState('');
  const [cycle, setCycle] = useState('');
  const [assertion, setAssertion] = useState('');
  const [note, setNote] = useState('');
  const doc = c.documentsById.get(docId);
  const add = () => {
    if (!docId || !cycle) return;
    act((s) => captureRiskFactor(s, { docId, block: block === '' ? null : Number(block), cycle, assertion: assertion || null, note }, params));
    setBlock('');
    setNote('');
  };
  return (
    <Card title="Facteurs de risque relevés dans les pièces">
      {factors.length === 0 ? (
        <p className="px-3 py-2 text-sm text-muted">Aucun facteur relevé. Relevez ici les passages des pièces de la gestion documentaire qui fondent votre évaluation.</p>
      ) : (
        <ul className="divide-y divide-line text-sm">
          {factors.map((f) => (
            <li key={f.id} className="flex flex-wrap items-start gap-2 px-3 py-1.5">
              <div className="min-w-0 flex-1">
                <Link to={`/ged/${encodeURIComponent(f.docId)}${f.block !== null ? `?bloc=${f.block + 1}` : ''}`} className="text-accent hover:underline">
                  {c.documentsById.get(f.docId)?.title ?? f.docId}
                </Link>
                {f.block !== null && <span className="text-xs text-muted"> – bloc {f.block + 1}</span>}
                <p className="text-xs text-muted">
                  {cycleLabel(params, f.cycle)}
                  {f.assertion ? ` – ${assertionLabel(params, f.assertion)}` : ''} · relevé le {formatDateFr(f.on)}
                  {f.note ? ` · ${f.note}` : ''}
                </p>
              </div>
              <Button variant="ghost" className="px-1.5 py-0 text-xs" aria-label={`Retirer le facteur relevé dans « ${c.documentsById.get(f.docId)?.title ?? f.docId} »`} onClick={() => act((s) => deleteRiskFactor(s, f.id))}>
                Retirer
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-2 border-t border-line px-3 py-2 md:grid-cols-2 xl:grid-cols-4">
        <Field id="rf-doc" label="Pièce" className="md:col-span-2">
          <Select
            id="rf-doc"
            value={docId}
            onChange={(e) => {
              setDocId(e.target.value);
              setBlock('');
            }}
            className="w-full"
          >
            <option value="">Choisir une pièce disponible…</option>
            {sorted.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="rf-block" label="Passage (facultatif)" className="md:col-span-2">
          <Select id="rf-block" value={block} onChange={(e) => setBlock(e.target.value)} disabled={!doc} className="w-full">
            <option value="">Document entier</option>
            {doc?.blocks.map((b, i) => (
              <option key={i} value={i}>
                Bloc {i + 1} – {excerpt(blockText(b))}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="rf-cycle" label="Cycle">
          <Select id="rf-cycle" value={cycle} onChange={(e) => setCycle(e.target.value)} className="w-full">
            <option value="">Choisir…</option>
            {params.cycles.cycles.map((cy) => (
              <option key={cy.id} value={cy.id}>
                {cy.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="rf-assertion" label="Assertion (facultatif)">
          <Select id="rf-assertion" value={assertion} onChange={(e) => setAssertion(e.target.value)} className="w-full">
            <option value="">Toutes</option>
            {params.planning.assertions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="rf-note" label="Note" className="md:col-span-2">
          <TextInput id="rf-note" value={note} onChange={(e) => setNote(e.target.value)} className="w-full" />
        </Field>
        <div className="flex items-end md:col-span-2">
          <Button onClick={add} disabled={!docId || !cycle}>
            Marquer comme facteur de risque
          </Button>
        </div>
      </div>
    </Card>
  );
}

function Coverage() {
  const c = useCase();
  const params = c.params;
  const planning = useGame((s) => s.game.planning);
  const program = useGame((s) => s.game.program);
  const rows = useMemo(() => coverage(planning, program, params), [planning, program, params]);
  return (
    <Card title="Couverture des risques par le programme">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Risques et procédures du programme qui y répondent</caption>
          <thead>
            <tr className="border-b border-line text-xs text-muted">
              <th scope="col" className="px-2 py-1.5 text-left font-medium">
                Risque
              </th>
              <th scope="col" className="px-2 py-1.5 text-left font-medium">
                Niveau
              </th>
              <th scope="col" className="px-2 py-1.5 text-left font-medium">
                Procédures au programme
              </th>
              <th scope="col" className="px-2 py-1.5 text-left font-medium">
                Couverture
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b border-line align-top">
                <th scope="row" className={cx('px-2 py-1 text-left font-normal', r.kind === 'assertion' && 'pl-6 text-xs')}>
                  {r.label}
                </th>
                <td className="px-2 py-1">{r.level ? <Badge tone={RISK_TONE[r.level]}>{riskLevelLabel(params, r.level)}</Badge> : <span className="text-xs text-muted">–</span>}</td>
                <td className="px-2 py-1 text-xs">{r.procedures.length ? r.procedures.map((id) => procedureDef(params, id)?.title ?? id).join(' ; ') : <span className="text-muted">aucune</span>}</td>
                <td className="px-2 py-1">{r.required ? r.covered ? <Badge tone="ok">Couvert</Badge> : <Badge tone="ko">Non couvert</Badge> : <span className="text-xs text-muted">{r.covered ? 'Couvert' : 'Sans réponse spécifique'}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function RisksTab() {
  const c = useCase();
  const params = c.params;
  const planning = useGame((s) => s.game.planning);
  const act = useGame((s) => s.act);
  const [errors, setErrors] = useState<string[] | null>(null);
  const validate = () => {
    const errs = riskErrors(params, planning);
    setErrors(errs);
    if (errs.length === 0) act((s) => validateRisks(s, params));
  };
  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-lg border border-line bg-panel px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" onClick={validate}>
            {planning.validated.risks ? 'Valider la révision des risques' : 'Valider l’évaluation des risques'}
          </Button>
          <span className="text-xs text-muted">
            {planning.validated.risks ? `Dernière validation le ${formatDateFr(planning.validated.risks)}. ` : ''}
            Les risques se révisent à tout moment, par exemple après la découverte d’un indice de fraude ; seuls les niveaux « élevé » et « risque important » demandent une justification.
          </span>
          {errors && errors.length === 0 && (
            <span role="status" className="text-xs text-ok">
              Évaluation des risques validée.
            </span>
          )}
        </div>
        {errors && errors.length > 0 && (
          <ul role="alert" className="list-disc space-y-0.5 pl-5 text-sm text-ko">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
      </div>
      <RiskMatrix />
      <div className="grid gap-4 xl:grid-cols-2">
        <FraudPresumption />
        <OverrideAndLaws />
      </div>
      <RiskFactors />
      <Coverage />
    </div>
  );
}
