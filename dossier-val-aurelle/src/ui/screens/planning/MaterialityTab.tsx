/**
 * Planification – Seuils (NEP 320, plan J4 §6.1): calculator on the data
 * available at the game date (certified 2024 accounts, extraction annualised,
 * draft accounts), usual ranges by base, derived thresholds, justification,
 * history of the decisions and mandatory revision at the final. The partner
 * reacts to a materiality outside the usual ranges (levels with reminders).
 */
import { useEffect, useMemo, useState } from 'react';
import { formatDateFr } from '../../../engine/dates';
import { formatAmount, formatEuro } from '../../../engine/format';
import {
  assessMateriality,
  baseAmount,
  currentMateriality,
  latestVintage,
  materialityErrors,
  materialityFrom,
  materialityRevisionDue,
  partnerReaction,
  thresholdsOf,
  validateMateriality,
  vintageInputs,
  type MaterialityChoice,
  type MaterialityFeedback,
  type MaterialityVintage,
} from '../../../game/planning';
import { useCase } from '../../app/context';
import { useGame } from '../../app/store';
import { Badge, Button, Card, Checkbox, cx, Select, TextInput } from '../../components/ui';
import { Field } from './Field';
import { formatPct } from './labels';
import { decimalText, draftFrom, emptyDraft, parseDecimal, usePlanningView } from './planningStore';

const VINTAGE_ORDER: readonly MaterialityVintage[] = ['certified2024', 'interim', 'draft2025'];

function Money({ cents }: { cents: number }) {
  return <span className="num whitespace-nowrap">{formatEuro(cents, 0)}</span>;
}

/** Range of amounts on one line, the currency once at the end. */
function MoneyRange({ from, to }: { from: number; to: number }) {
  return (
    <span className="num whitespace-nowrap">
      {formatAmount(from, 0)} – {formatEuro(to, 0)}
    </span>
  );
}

export function MaterialityTab() {
  const c = useCase();
  const params = c.params;
  const planning = useGame((s) => s.game.planning);
  const difficulty = useGame((s) => s.game.difficulty);
  const date = useGame((s) => s.game.clock.date);
  const act = useGame((s) => s.act);
  const { draft, setDraft, updateDraft } = usePlanningView();
  const [errors, setErrors] = useState<string[]>([]);
  const [reaction, setReaction] = useState<{ text: string; feedback: MaterialityFeedback[] } | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const inputs = useMemo(
    () =>
      vintageInputs({
        current: c.balances().current,
        prior: c.balances().prior,
        chart: c.presented.chart,
        statements: params.statements,
        presentation: c.presented.presentation,
        view: c.view,
        currentYear: params.scenario.years.current,
      }),
    [c, params],
  );
  const available = VINTAGE_ORDER.filter((v) => inputs[v]);
  const current = currentMateriality(planning);
  const revisionDue = materialityRevisionDue(planning, params, date);

  // the draft starts from the decision in force, on the latest data available
  useEffect(() => {
    if (draft && draft.vintage && inputs[draft.vintage]) return;
    const v = latestVintage(inputs);
    const units = params.planning.thresholds.roundingEuros;
    setDraft(current ? draftFrom(current, v, units) : emptyDraft(v, units));
  }, [draft, inputs, current, setDraft, params]);

  const d = draft ?? emptyDraft(latestVintage(inputs), params.planning.thresholds.roundingEuros);
  const vintage = d.vintage && inputs[d.vintage] ? d.vintage : latestVintage(inputs);
  const input = inputs[vintage]!;
  const amounts = useMemo(() => new Map(params.planning.bases.map((b) => [b.id, baseAmount(b, input)])), [params, input]);
  const base = params.planning.bases.find((b) => b.id === d.base);
  const pct = parseDecimal(d.pct);
  const planningPct = parseDecimal(d.planningPct);
  const trivialPct = parseDecimal(d.trivialPct);
  const specificPct = d.specific ? parseDecimal(d.specificPct) : null;
  const amount = base && Number.isFinite(pct) ? materialityFrom(amounts.get(base.id) ?? 0, pct, d.rounding) : 0;
  const thresholds = thresholdsOf({ amount, planningPct: Number.isFinite(planningPct) ? planningPct : 0, trivialPct: Number.isFinite(trivialPct) ? trivialPct : 0, specificPct: specificPct !== null && Number.isFinite(specificPct) ? specificPct : null });
  const t = params.planning.thresholds;

  const choice = (): Omit<MaterialityChoice, 'on'> => ({
    base: d.base,
    vintage,
    baseAmount: base ? (amounts.get(base.id) ?? 0) : 0,
    pct: Number.isFinite(pct) ? pct : 0,
    amount,
    planningPct: Number.isFinite(planningPct) ? planningPct : 0,
    trivialPct: Number.isFinite(trivialPct) ? trivialPct : 0,
    specificPct: specificPct === null ? null : Number.isFinite(specificPct) ? specificPct : 0,
    factors: d.factors,
    comment: d.comment,
  });

  const validate = () => {
    const ch = choice();
    const errs = materialityErrors(params, { ...ch, on: date });
    setErrors(errs);
    setSaved(null);
    if (errs.length) return;
    act((s) => validateMateriality(s, params, ch));
    const feedback = assessMateriality(params, ch);
    const text = partnerReaction(params, difficulty, feedback);
    setReaction(text ? { text, feedback: feedback.filter((f) => f.tone !== 'ok') } : null);
    setSaved(`Seuil validé le ${formatDateFr(date)}.`);
  };

  const partner = params.game.firm.find((f) => f.id === 'partner')?.name ?? 'L’associée';
  const vintageLabel = (v: MaterialityVintage) => {
    const label = params.planning.vintages[v]?.label ?? v;
    return v === 'interim' && inputs.interim ? `${label}, ${inputs.interim.months} mois au ${formatDateFr(c.view.cutoff)}` : label;
  };

  return (
    <div className="space-y-4">
      {revisionDue && (
        <div role="status" className="rounded-lg border border-warn/40 bg-warn/10 px-4 py-2 text-sm">
          Le final a commencé : le seuil doit être revu sur le projet de comptes {params.scenario.years.current} et validé à nouveau.
        </div>
      )}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card title="Calcul du seuil de signification">
          <div className="space-y-4 p-3">
            <fieldset>
              <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Données de référence</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {VINTAGE_ORDER.map((v) => (
                  <label key={v} className={cx('inline-flex items-center gap-1.5 text-sm', !inputs[v] && 'text-muted')}>
                    <input type="radio" name="mat-vintage" value={v} checked={vintage === v} disabled={!inputs[v]} onChange={() => updateDraft({ vintage: v })} className="accent-[var(--accent)]" />
                    {vintageLabel(v)}
                    {!inputs[v] && <span className="text-xs">(pas encore disponible)</span>}
                  </label>
                ))}
              </div>
            </fieldset>
            <table className="w-full text-sm">
              <caption className="sr-only">Bases possibles du seuil, montant sur les données retenues et plage usuelle</caption>
              <thead>
                <tr className="border-b border-line text-xs text-muted">
                  <th scope="col" className="px-2 py-1.5 text-left font-medium">
                    Base
                  </th>
                  <th scope="col" className="px-2 py-1.5 text-right font-medium">
                    Montant
                  </th>
                  <th scope="col" className="px-2 py-1.5 text-right font-medium">
                    Plage usuelle
                  </th>
                  <th scope="col" className="px-2 py-1.5 text-right font-medium">
                    Seuil correspondant
                  </th>
                </tr>
              </thead>
              <tbody>
                {params.planning.bases.map((b) => {
                  const a = amounts.get(b.id) ?? 0;
                  const id = `mat-base-${b.id}`;
                  return (
                    <tr key={b.id} className={cx('border-b border-line', d.base === b.id && 'bg-accent-soft')}>
                      <td className="px-2 py-1.5">
                        <label htmlFor={id} className="inline-flex cursor-pointer items-center gap-1.5">
                          <input id={id} type="radio" name="mat-base" checked={d.base === b.id} onChange={() => updateDraft({ base: b.id })} className="accent-[var(--accent)]" />
                          {b.label}
                        </label>
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <Money cents={a} />
                      </td>
                      <td className="px-2 py-1.5 text-right whitespace-nowrap">
                        {formatPct(b.pctRange[0])} – {formatPct(b.pctRange[1])}
                      </td>
                      <td className="px-2 py-1.5 text-right text-xs text-muted">
                        <MoneyRange from={materialityFrom(a, b.pctRange[0], 0)} to={materialityFrom(a, b.pctRange[1], 0)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field id="mat-pct" label="Pourcentage de la base">
                <TextInput id="mat-pct" inputMode="decimal" value={d.pct} placeholder={base ? `${decimalText(base.pctRange[0])} à ${decimalText(base.pctRange[1])}` : 'choisir une base'} onChange={(e) => updateDraft({ pct: e.target.value })} invalid={d.pct !== '' && !Number.isFinite(pct)} className="w-full" />
              </Field>
              <Field id="mat-rounding" label="Arrondi">
                <Select id="mat-rounding" value={d.rounding} onChange={(e) => updateDraft({ rounding: Number(e.target.value) })} className="w-full">
                  {t.roundingEuros.map((r) => (
                    <option key={r} value={r}>
                      {r === 0 ? 'Aucun' : formatEuro(r * 100, 0)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id="mat-planning" label="Seuil de planification (% du seuil)">
                <TextInput id="mat-planning" inputMode="decimal" value={d.planningPct} placeholder={`${decimalText(t.planningPctRange[0])} à ${decimalText(t.planningPctRange[1])}`} onChange={(e) => updateDraft({ planningPct: e.target.value })} invalid={d.planningPct !== '' && !Number.isFinite(planningPct)} className="w-full" />
              </Field>
              <Field id="mat-trivial" label="Anomalies insignifiantes (% du seuil)">
                <TextInput id="mat-trivial" inputMode="decimal" value={d.trivialPct} placeholder={`${decimalText(t.trivialPctRange[0])} à ${decimalText(t.trivialPctRange[1])}`} onChange={(e) => updateDraft({ trivialPct: e.target.value })} invalid={d.trivialPct !== '' && !Number.isFinite(trivialPct)} className="w-full" />
              </Field>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <Checkbox id="mat-specific" label="Seuil spécifique pour les conventions réglementées" checked={d.specific} onChange={(v) => updateDraft({ specific: v })} />
              {d.specific && (
                <Field id="mat-specific-pct" label="Seuil spécifique (% du seuil)">
                  <TextInput id="mat-specific-pct" inputMode="decimal" value={d.specificPct} placeholder={`${decimalText(t.specificPctRange[0])} à ${decimalText(t.specificPctRange[1])}`} onChange={(e) => updateDraft({ specificPct: e.target.value })} invalid={d.specificPct !== '' && specificPct !== null && !Number.isFinite(specificPct)} className="w-40" />
                </Field>
              )}
            </div>
            <dl className="grid grid-cols-2 gap-3 rounded-md border border-line bg-sunken px-3 py-2 lg:grid-cols-4" aria-live="polite">
              <div>
                <dt className="text-xs text-muted">Seuil de signification</dt>
                <dd className="text-base font-semibold">{amount > 0 ? <Money cents={thresholds.materiality} /> : '–'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Seuil de planification</dt>
                <dd className="text-base">{amount > 0 && thresholds.planning > 0 ? <Money cents={thresholds.planning} /> : '–'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Anomalies manifestement insignifiantes</dt>
                <dd className="text-base">{amount > 0 && thresholds.trivial > 0 ? <Money cents={thresholds.trivial} /> : '–'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Seuil spécifique</dt>
                <dd className="text-base">{thresholds.specific !== null && thresholds.specific > 0 ? <Money cents={thresholds.specific} /> : '–'}</dd>
              </div>
            </dl>
          </div>
        </Card>
        <div className="space-y-4">
          <Card title="Justification">
            <div className="space-y-3 p-3">
              <fieldset>
                <legend className="mb-1 text-xs text-muted">Facteurs retenus pour le choix de la base et des pourcentages</legend>
                <div className="space-y-1">
                  {params.planning.factors.map((f) => (
                    <div key={f.id}>
                      <Checkbox id={`mat-factor-${f.id}`} label={f.label} checked={d.factors.includes(f.id)} onChange={(v) => updateDraft({ factors: v ? [...d.factors, f.id] : d.factors.filter((x) => x !== f.id) })} />
                    </div>
                  ))}
                </div>
              </fieldset>
              <Field id="mat-comment" label="Commentaire">
                <textarea id="mat-comment" value={d.comment} onChange={(e) => updateDraft({ comment: e.target.value })} rows={3} className="w-full rounded-md border border-line bg-panel px-2 py-1 text-sm" />
              </Field>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="primary" onClick={validate}>
                  {current ? 'Valider la révision du seuil' : 'Valider le seuil'}
                </Button>
                {saved && (
                  <span role="status" className="text-xs text-ok">
                    {saved}
                  </span>
                )}
              </div>
              {errors.length > 0 && (
                <ul role="alert" className="list-disc space-y-0.5 pl-5 text-sm text-ko">
                  {errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
          {reaction && (
            <Card title={`Message de ${partner}`} actions={<Button variant="ghost" className="px-1.5 py-0 text-xs" onClick={() => setReaction(null)}>Fermer</Button>}>
              <div className="space-y-2 px-3 py-2 text-sm">
                <p>{reaction.text}</p>
                <ul className="list-disc space-y-0.5 pl-5 text-muted">
                  {reaction.feedback.map((f) => (
                    <li key={f.text}>{f.text}</li>
                  ))}
                </ul>
              </div>
            </Card>
          )}
        </div>
      </div>
      <Card title="Historique des seuils validés">
        {planning.materiality.length === 0 ? (
          <p className="px-3 py-3 text-sm text-muted">Aucun seuil validé.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Seuils validés, du plus ancien au plus récent</caption>
              <thead>
                <tr className="border-b border-line text-xs text-muted">
                  {['Date', 'Données', 'Base', '%', 'Seuil', 'Planification', 'Insignifiantes', 'Spécifique', ''].map((h, i) => (
                    <th key={i} scope="col" className={cx('px-2 py-1.5 font-medium', i >= 3 && i <= 7 ? 'text-right' : 'text-left')}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {planning.materiality.map((m, i) => {
                  const th = thresholdsOf(m);
                  return (
                    <tr key={`${m.on}-${i}`} className="border-b border-line">
                      <td className="px-2 py-1.5 whitespace-nowrap">{formatDateFr(m.on)}</td>
                      <td className="px-2 py-1.5">{params.planning.vintages[m.vintage]?.label ?? m.vintage}</td>
                      <td className="px-2 py-1.5">{params.planning.bases.find((b) => b.id === m.base)?.label ?? m.base}</td>
                      <td className="px-2 py-1.5 text-right">{formatPct(m.pct)}</td>
                      <td className="px-2 py-1.5 text-right font-semibold">
                        <Money cents={th.materiality} />
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <Money cents={th.planning} /> <span className="text-xs text-muted">({formatPct(m.planningPct)})</span>
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <Money cents={th.trivial} /> <span className="text-xs text-muted">({formatPct(m.trivialPct)})</span>
                      </td>
                      <td className="px-2 py-1.5 text-right">{th.specific === null ? '–' : <Money cents={th.specific} />}</td>
                      <td className="px-2 py-1.5">{i === planning.materiality.length - 1 && <Badge tone="ok">En vigueur</Badge>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
