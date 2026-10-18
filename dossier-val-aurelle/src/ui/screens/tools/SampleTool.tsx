/**
 * Sampling tool (plan J4 §10, J4-8), opened by a procedure on its
 * population: method, size computed from the planning materiality, the risk
 * assessed and the reliance on the controls tested, seed shown; the sample is
 * frozen at the draw (a new draw costs hours and stays visible). Each item is
 * marked with the ticking marks of J3, its misstatement noted and its
 * supporting document requested; the exceptions are projected on the
 * population and can become a finding.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { formatDateFr } from '../../../engine/dates';
import { riskLevelOf, planningThreshold, type RiskLevel } from '../../../game/planning';
import {
  addSample,
  controlRelianceOf,
  draw,
  nextSeed,
  plannedSize,
  populationDef,
  populationItems,
  sampleCell,
  sampleProjection,
  setSampleException,
  type ControlReliance,
  type PopulationItem,
  type Sample,
  type SampleMethod,
} from '../../../game/samples';
import { setTick } from '../../../game/state';
import { vintageDates } from '../../../game/vintages';
import { useCase } from '../../app/context';
import { useGame } from '../../app/store';
import { Amount } from '../../components/Amount';
import { Badge, Button, Select, TextInput } from '../../components/ui';
import { NewFindingButton } from '../findings/NewFindingButton';
import { AmountInput } from './AmountInput';
import { RequestButton } from './RequestControls';

export const METHOD_LABELS: Readonly<Record<SampleMethod, string>> = {
  monetaryUnit: 'Par unités monétaires (strate haute à 100 %)',
  random: 'Aléatoire',
  systematic: 'Systématique',
  stratified: 'Par strates',
  specific: 'Éléments spécifiques (sans extrapolation)',
};

const CONTROL_LABELS: Readonly<Record<ControlReliance, string>> = {
  effective: 'Contrôles testés et efficaces',
  notTested: 'Contrôles non testés',
  deficient: 'Contrôles défaillants',
};

/** Unit of the items of a population, in the plural when needed (« écritures », « programmes × mois »). */
function unitText(unit: string, n: number): string {
  if (n <= 1) return unit;
  return unit.split(' × ').map((w) => (w.endsWith('s') ? w : `${w}s`)).join(' × ');
}

function formatHours(h: number): string {
  return h.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
}

/** Reference of an item: the FEC number (link to the FEC), or its key. */
function ItemRef({ item }: { item: PopulationItem }): ReactNode {
  const m = /^(\d{4}):([A-Z]{2}\d{6})$/.exec(item.key);
  if (m) {
    return (
      <Link to={`/fec?ecriture=${m[2]}&exercice=${m[1]}`} className="font-mono text-accent underline-offset-2 hover:underline">
        {m[2]}
      </Link>
    );
  }
  if (item.key.startsWith('inv:')) return <span className="font-mono">{item.piece ?? item.key.slice(4)}</span>;
  return <span className="font-mono text-xs">{item.piece ?? (item.programme ? item.key.split(':')[1] ?? item.key : item.key)}</span>;
}

function DrawForm({ executionId, population, items, onDrawn, cycle }: { executionId: string | null; population: string; items: readonly PopulationItem[]; onDrawn: (id: string) => void; cycle: string }) {
  const c = useCase();
  const params = c.params;
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const tolerable = planningThreshold(game.planning);
  const [method, setMethod] = useState<SampleMethod>('monetaryUnit');
  const [risk, setRisk] = useState<RiskLevel>(riskLevelOf(game.planning, cycle));
  const [controls, setControls] = useState<ControlReliance>(controlRelianceOf(game, params, cycle));
  const [seed, setSeed] = useState(nextSeed(game, population));
  const [threshold, setThreshold] = useState<number | null>(tolerable);
  const planned = tolerable !== null ? plannedSize(params, items, { risk, controls, tolerable }) : null;
  const [sizeText, setSizeText] = useState('');
  const size = sizeText.trim() ? Math.max(1, Math.min(items.length, Math.round(Number(sizeText)))) : (planned ?? params.sampling.minSize);
  const sizeInvalid = sizeText.trim() !== '' && !Number.isFinite(Number(sizeText));
  const redraw = game.samples.items.some((x) => x.population === population && x.executionId === executionId);
  const cost = executionId === null ? params.sampling.drawHours : redraw ? params.sampling.redrawHours : 0;
  const idp = `sample-${executionId ?? 'free'}-${population}`;

  const run = () => {
    const result = draw(params, items, { population, method, seed: seed.trim() || nextSeed(game, population), size, ...(method === 'specific' && threshold !== null ? { threshold } : {}), ...(tolerable !== null ? { plan: { risk, controls, tolerable } } : {}) });
    const id = `smp${game.samples.items.length + 1}`;
    act((s) => addSample(s, { executionId, population, method, seed: seed.trim() || nextSeed(s, population), result, title: populationDef(population)?.label ?? population }));
    onDrawn(id);
  };

  return (
    <div className="space-y-2 rounded-md border border-line p-3">
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label>
          <span className="block text-xs text-muted">Méthode</span>
          <Select id={`${idp}-method`} value={method} onChange={(e) => setMethod(e.target.value as SampleMethod)}>
            {(Object.keys(METHOD_LABELS) as SampleMethod[]).map((m) => (
              <option key={m} value={m}>
                {METHOD_LABELS[m]}
              </option>
            ))}
          </Select>
        </label>
        {method !== 'specific' ? (
          <>
            <label>
              <span className="block text-xs text-muted">Risque évalué du cycle</span>
              <Select value={risk} onChange={(e) => setRisk(e.target.value as RiskLevel)}>
                {params.planning.riskLevels.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              <span className="block text-xs text-muted">Contrôles internes</span>
              <Select value={controls} onChange={(e) => setControls(e.target.value as ControlReliance)}>
                {(Object.keys(CONTROL_LABELS) as ControlReliance[]).map((k) => (
                  <option key={k} value={k}>
                    {CONTROL_LABELS[k]}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              <span className="block text-xs text-muted">Taille {planned !== null ? `(calculée : ${planned})` : ''}</span>
              <TextInput value={sizeText} invalid={sizeInvalid} onChange={(e) => setSizeText(e.target.value)} placeholder={String(planned ?? params.sampling.minSize)} inputMode="numeric" className="w-20 text-right" />
            </label>
          </>
        ) : (
          <label>
            <span className="block text-xs text-muted">Tous les éléments au-delà de (euros)</span>
            <AmountInput cents={threshold} onCommit={setThreshold} label="Seuil de sélection des éléments spécifiques, en euros" />
          </label>
        )}
        <label>
          <span className="block text-xs text-muted">Graine du tirage</span>
          <TextInput value={seed} onChange={(e) => setSeed(e.target.value)} className="w-48 font-mono" spellCheck={false} />
        </label>
        <Button variant="primary" onClick={run} disabled={sizeInvalid || items.length === 0 || (method === 'specific' && threshold === null)}>
          {redraw ? 'Nouveau tirage' : 'Tirer l’échantillon'}
        </Button>
      </div>
      <p className="text-xs text-muted">
        {tolerable !== null ? (
          <>
            Anomalie tolérable : seuil de planification de <Amount cents={tolerable} /> € ; facteurs de confiance et anomalie attendue selon les paramètres du cabinet (à vérifier).
          </>
        ) : (
          'Le seuil de planification n’est pas encore fixé : la taille ne peut pas être calculée, saisissez-la.'
        )}{' '}
        {cost > 0 ? `Ce tirage coûte ${formatHours(cost)} h de votre temps.` : 'Le premier tirage fait partie des heures de la procédure.'} L’échantillon est figé au tirage.
      </p>
    </div>
  );
}

function SampleView({ sample, items, cycle }: { sample: Sample; items: readonly PopulationItem[]; cycle: string }) {
  const c = useCase();
  const params = c.params;
  const act = useGame((s) => s.act);
  const ticks = useGame((s) => s.game.ticks);
  const marks = useGame((s) => s.game.tickMarks);
  const byKey = useMemo(() => new Map(items.map((x) => [x.key, x])), [items]);
  const pr = sampleProjection(sample, items);
  const marked = sample.items.filter((k) => ticks[sampleCell(sample.id, k)] !== undefined).length;
  const def = populationDef(sample.population);
  const interval = sample.parameters['interval'];
  return (
    <div className="space-y-2">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-muted">Méthode</dt>
          <dd>{METHOD_LABELS[sample.method]}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Graine</dt>
          <dd className="font-mono text-xs">{sample.seed || '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Tirage du</dt>
          <dd>{formatDateFr(sample.drawnOn)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Éléments marqués</dt>
          <dd className="num">
            {marked} / {sample.items.length}
          </dd>
        </div>
        {typeof interval === 'number' && interval > 0 && (
          <div>
            <dt className="text-xs text-muted">Intervalle</dt>
            <dd>
              <Amount cents={interval} />
            </dd>
          </div>
        )}
        <div>
          <dt className="text-xs text-muted">Population</dt>
          <dd>
            {items.length} {unitText(def?.unit ?? 'élément', items.length)} – <Amount cents={pr.populationValue} />
          </dd>
        </div>
      </dl>
      <div className="overflow-x-auto rounded-md border border-line">
        <table className="w-full text-sm">
          <caption className="sr-only">Éléments de l’échantillon {sample.id} : marque, anomalie relevée et pièce justificative</caption>
          <thead>
            <tr className="border-b border-line bg-sunken text-xs text-muted">
              <th scope="col" className="px-2 py-1 text-left font-medium">
                Élément
              </th>
              <th scope="col" className="px-2 py-1 text-left font-medium">
                Libellé
              </th>
              <th scope="col" className="px-2 py-1 text-right font-medium">
                Montant
              </th>
            </tr>
          </thead>
          {sample.items.map((k) => {
            const it = byKey.get(k);
            const cell = sampleCell(sample.id, k);
            if (!it)
              return (
                <tbody key={k} className="border-b border-line last:border-b-0">
                  <tr>
                    <td className="px-2 py-1 font-mono text-xs">{k}</td>
                    <td colSpan={2} className="px-2 py-1 text-xs text-muted">
                      Élément absent des données disponibles à la date du dossier.
                    </td>
                  </tr>
                </tbody>
              );
            const name = it.piece ?? k;
            const meta = [it.thirdParty, it.programme, it.account ? `compte ${it.account}` : undefined].filter(Boolean).join(' · ');
            return (
              <tbody key={k} className="border-b border-line last:border-b-0">
                <tr className="align-top">
                  <th scope="row" className="whitespace-nowrap px-2 pt-1.5 text-left font-normal">
                    <ItemRef item={it} />
                    <span className="block font-mono text-xs text-muted">{it.date ? formatDateFr(it.date) : '—'}</span>
                  </th>
                  <td className="px-2 pt-1.5">
                    <span className="line-clamp-2" title={it.label}>
                      {it.label}
                    </span>
                    {meta && <span className="block text-xs text-muted">{meta}</span>}
                  </td>
                  <td className="whitespace-nowrap px-2 pt-1.5 text-right">
                    <Amount cents={it.amount} decimals={2} />
                  </td>
                </tr>
                <tr>
                  <td colSpan={3} className="px-2 pb-1.5 pt-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Select aria-label={`Marque de l’élément ${name}`} value={ticks[cell] ?? ''} onChange={(e) => act((s) => setTick(s, cell, e.target.value || null))} className="w-44 py-0.5 text-xs">
                        <option value="">Marque : —</option>
                        {marks.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.symbol} {m.label}
                          </option>
                        ))}
                      </Select>
                      <AmountInput cents={sample.exceptions?.[k] ?? null} onCommit={(v) => act((s) => setSampleException(s, sample.id, k, v))} label={`Anomalie relevée sur l’élément ${name}, en euros`} placeholder="Anomalie (euros)" className="w-36 py-0.5 text-right font-mono text-xs" />
                      {it.request && <RequestButton family={it.request.family} object={it.request.object} compact />}
                    </div>
                  </td>
                </tr>
              </tbody>
            );
          })}
        </table>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-2 text-sm">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted">Valeur testée</dt>
            <dd>
              <Amount cents={pr.sampleValue} decimals={2} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Anomalies relevées</dt>
            <dd>{pr.exceptions === 0 ? 'aucune' : <>{pr.exceptions} – <Amount cents={pr.found} decimals={2} /></>}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Extrapolation à la population</dt>
            <dd>{sample.method === 'specific' ? 'sans objet (éléments spécifiques)' : pr.exceptions === 0 ? 'aucune' : <Amount cents={pr.projected} decimals={2} />}</dd>
          </div>
        </dl>
        {pr.exceptions > 0 && (
          <NewFindingButton
            seed={{
              cycle,
              evidence: [{ kind: 'sample', id: sample.id }],
              amount: Math.abs(sample.method === 'specific' ? pr.found : pr.projected),
              label: `Échantillon ${sample.id} – ${def?.label ?? sample.population} : ${pr.exceptions} ${pr.exceptions > 1 ? 'exceptions' : 'exception'}`,
            }}
          />
        )}
      </div>
      <p className="text-xs text-muted">Marquez chaque élément après examen de sa pièce justificative (marques du pointage) ; une anomalie relevée est extrapolée selon la méthode du tirage. Paramètres : {params.sampling.minSize} à {params.sampling.maxSize} éléments.</p>
    </div>
  );
}

/** Sample of a procedure (or outside any procedure when `executionId` is null) on a population. */
export function SampleTool({ executionId, population, cycle: cycleOverride }: { executionId: string | null; population: string; cycle?: string }) {
  const c = useCase();
  const params = c.params;
  const samples = useGame((s) => s.game.samples.items);
  const def = populationDef(population);
  const cycle = cycleOverride ?? def?.cycle ?? 'crossCycle';
  const mine = samples.filter((x) => x.executionId === executionId && x.population === population);
  const [selected, setSelected] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);
  const world = useMemo(() => ({ ...c.presented, ledgers: { ...c.presented.ledgers, current: c.ledger2025 } }), [c]);
  const ready = def ? (def.needs === 'yearEnd' ? c.view.ledger2025 === 'draft' : c.view.ledger2025 !== 'none') : false;
  const items = useMemo(() => (ready ? populationItems(population, world, params) : []), [ready, population, world, params]);

  if (!def) return <p className="text-sm text-muted">Population inconnue.</p>;
  if (!ready) {
    const v = vintageDates(params);
    return (
      <p className="text-sm text-muted">
        {def.label} : {def.needs === 'yearEnd' ? `population disponible avec les données de clôture (balance et FEC définitifs attendus le ${formatDateFr(v.draftLedger)}).` : `population disponible avec l’extraction comptable au ${formatDateFr(v.cutoff)} (à demander au chef comptable) ou avec la balance définitive.`}
      </p>
    );
  }
  const current = mine.find((x) => x.id === selected) ?? mine[mine.length - 1];
  return (
    <div className="space-y-3">
      <p className="text-sm">
        <span className="font-medium">{def.label}</span> <span className="text-muted">– {def.description}</span>
      </p>
      {mine.length > 1 && (
        <div className="flex flex-wrap items-center gap-1 text-sm" role="group" aria-label="Tirages de la procédure">
          {mine.map((x, i) => (
            <Button key={x.id} variant={x.id === current?.id ? 'primary' : 'default'} className="px-2 py-0.5 text-xs" aria-pressed={x.id === current?.id} onClick={() => setSelected(x.id)}>
              Tirage {i + 1} ({formatDateFr(x.drawnOn)})
            </Button>
          ))}
          <Badge tone="warn">Nouveaux tirages tracés au dossier</Badge>
        </div>
      )}
      {(!current || drawing) && (
        <DrawForm
          executionId={executionId}
          population={population}
          items={items}
          cycle={cycle}
          onDrawn={(id) => {
            setSelected(id);
            setDrawing(false);
          }}
        />
      )}
      {current && <SampleView sample={current} items={items} cycle={cycle} />}
      {current && !drawing && (
        <Button variant="ghost" className="px-1.5 py-0 text-xs" onClick={() => setDrawing(true)}>
          Nouveau tirage (nouvelle graine)…
        </Button>
      )}
    </div>
  );
}
