/**
 * Planification – Programme (NEP 300, 330; plan J4 §6.3): the firm's 2024
 * programme proposed by the manager as a starting point, the programme
 * (assignment, hours by member against the budget), the library filtered by
 * cycle, risk and phase, and the validation (mandatory diligences).
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { formatDateFr } from '../../../engine/dates';
import type { MemberId } from '../../../game/calendar';
import { maxRiskOfCycle, riskRank, uncoveredRisks } from '../../../game/planning';
import {
  adoptFirmProgramme,
  allowedMembers,
  assignProcedure,
  isRequired,
  plannedHours,
  planProcedure,
  procedureDef,
  procedureHours,
  programmeCheck,
  TEAM,
  unplanProcedure,
  validateProgramme,
} from '../../../game/program';
import { fold } from '../../../game/text';
import type { ProcedureDef } from '../../../scenario/schemas/procedures';
import { useCase } from '../../app/context';
import { useGame } from '../../app/store';
import { Badge, Button, Card, cx, Select, TextInput } from '../../components/ui';
import { AidButton } from '../work/AidButton';
import { Field } from './Field';
import { cycleLabel, formatHours, MANDATORY_LABEL, memberShort, outputText, OVERRIDE_LABEL, phasesText } from './labels';
import { DEFAULT_LIBRARY, usePlanningView } from './planningStore';

function Flags({ def }: { def: ProcedureDef }) {
  return (
    <>
      {def.mandatory && <Badge tone="accent">{MANDATORY_LABEL}</Badge>}
      {def.overrideResponse && <Badge tone="warn">{OVERRIDE_LABEL}</Badge>}
    </>
  );
}

function HoursByProfile({ def }: { def: ProcedureDef }) {
  const c = useCase();
  return (
    <span className="text-xs text-muted">
      {TEAM.filter((m) => procedureHours(def, m, c.params) !== undefined)
        .map((m) => `${memberShort(c.params, m)} ${formatHours(procedureHours(def, m, c.params)!)} h`)
        .join(' · ')}
    </span>
  );
}

function BudgetSummary() {
  const c = useCase();
  const params = c.params;
  const program = useGame((s) => s.game.program);
  const difficulty = useGame((s) => s.game.difficulty);
  const h = plannedHours(program, params);
  const budget = params.game.budgetHours[difficulty];
  const ceiling = budget * (1 + params.game.overrunTolerancePct / 100);
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">Heures prévues au programme par membre, comparées aux budgets indicatifs</caption>
      <thead>
        <tr className="border-b border-line text-xs text-muted">
          <th scope="col" className="px-3 py-1.5 text-left font-medium">
            Membre
          </th>
          <th scope="col" className="px-2 py-1.5 text-right font-medium">
            Prévu
          </th>
          <th scope="col" className="px-3 py-1.5 text-right font-medium">
            Budget indicatif
          </th>
        </tr>
      </thead>
      <tbody>
        {params.game.team.map((m) => {
          const planned = h.byMember[m.id];
          const allotted = m.hoursByDifficulty[difficulty];
          return (
            <tr key={m.id} className="border-b border-line">
              <th scope="row" className="px-3 py-1 text-left font-normal">
                {m.name}
                {m.id === 'sofia' && <span className="text-xs text-muted"> (enveloppe à part)</span>}
              </th>
              <td className={cx('num px-2 py-1 text-right', planned > allotted && 'text-warn')}>{formatHours(planned)} h</td>
              <td className="num px-3 py-1 text-right text-muted">{allotted} h</td>
            </tr>
          );
        })}
        <tr className="font-semibold">
          <th scope="row" className="px-3 py-1.5 text-left">
            Équipe (budget de la mission)
          </th>
          <td className={cx('num px-2 py-1.5 text-right', h.team > ceiling ? 'text-ko' : h.team > budget && 'text-warn')}>{formatHours(h.team)} h</td>
          <td className="num px-3 py-1.5 text-right">
            {budget} h <span className="text-xs font-normal text-muted">(tolérance {params.game.overrunTolerancePct} %)</span>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function ProgrammeTable() {
  const c = useCase();
  const params = c.params;
  const program = useGame((s) => s.game.program);
  const act = useGame((s) => s.act);
  const launched = new Set(program.executions.map((e) => e.procedureId));
  const byCycle = useMemo(() => {
    const m = new Map<string, { def: ProcedureDef; assignee: MemberId }[]>();
    for (const p of program.planned) {
      const def = procedureDef(params, p.procedureId);
      if (!def) continue;
      m.set(def.cycle, [...(m.get(def.cycle) ?? []), { def, assignee: p.assignee }]);
    }
    return params.cycles.cycles.filter((cy) => m.has(cy.id)).map((cy) => ({ cycle: cy, items: m.get(cy.id)! }));
  }, [program.planned, params]);
  if (program.planned.length === 0) return <p className="px-3 py-4 text-sm text-muted">Le programme est vide. Partez du programme 2024 du cabinet, ou ajoutez des procédures depuis la bibliothèque.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">Procédures du programme, par cycle, avec l’intervenant et les heures prévues</caption>
        <thead>
          <tr className="border-b border-line text-xs text-muted">
            <th scope="col" className="px-3 py-1.5 text-left font-medium">
              Procédure
            </th>
            <th scope="col" className="px-2 py-1.5 text-left font-medium">
              Phases
            </th>
            <th scope="col" className="w-36 px-2 py-1.5 text-left font-medium">
              Intervenant
            </th>
            <th scope="col" className="px-2 py-1.5 text-right font-medium">
              Heures
            </th>
            <th scope="col" className="px-3 py-1.5">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        {byCycle.map(({ cycle, items }) => (
          <tbody key={cycle.id}>
            <tr className="bg-sunken">
              <th scope="colgroup" colSpan={5} className="px-3 py-1 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                {cycle.label}
              </th>
            </tr>
            {items.map(({ def, assignee }) => {
              const isLaunched = launched.has(def.id);
              return (
                <tr key={def.id} className="border-b border-line">
                  <th scope="row" className="px-3 py-1 text-left font-normal">
                    <span className="mr-1">{def.title}</span>
                    <Flags def={def} />
                    {isLaunched && <Badge tone="ok">Lancée</Badge>}
                  </th>
                  <td className="px-2 py-1 text-xs text-muted">{phasesText(params, def)}</td>
                  <td className="px-2 py-1">
                    <Select aria-label={`Intervenant – ${def.title}`} value={assignee} disabled={isLaunched} onChange={(e) => act((s) => assignProcedure(s, params, def.id, e.target.value as MemberId))} className="w-full py-0.5">
                      {allowedMembers(def, params).map((m) => (
                        <option key={m} value={m}>
                          {memberShort(params, m)}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="num px-2 py-1 text-right">{formatHours(procedureHours(def, assignee, params) ?? 0)} h</td>
                  <td className="px-3 py-1 text-right">
                    <Button
                      variant="ghost"
                      className="px-1.5 py-0 text-xs"
                      disabled={isRequired(def) || isLaunched}
                      title={isRequired(def) ? 'Procédure obligatoire' : isLaunched ? 'Procédure déjà lancée' : undefined}
                      aria-label={`Retirer « ${def.title} » du programme`}
                      onClick={() => act((s) => unplanProcedure(s, params, def.id))}
                    >
                      Retirer
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        ))}
      </table>
    </div>
  );
}

function Library() {
  const c = useCase();
  const params = c.params;
  const planning = useGame((s) => s.game.planning);
  const program = useGame((s) => s.game.program);
  const act = useGame((s) => s.act);
  const { library: f, setLibrary } = usePlanningView();
  const [openId, setOpenId] = useState<string | null>(null);
  const planned = new Set(program.planned.map((p) => p.procedureId));
  const list = useMemo(() => {
    const words = fold(f.query).split(/\s+/).filter(Boolean);
    const uncovered = f.risk === 'uncovered' ? uncoveredRisks(planning, program, params).map((r) => r.key) : [];
    const high = params.cycles.cycles.filter((cy) => riskRank(maxRiskOfCycle(planning, cy.id)) >= riskRank('high')).map((cy) => cy.id);
    const answers = (d: ProcedureDef, key: string) => (key === 'override' ? d.overrideResponse === true : d.risksAddressed.some((r) => r === key || (!key.includes(':') && r.startsWith(`${key}:`))));
    return params.procedures.procedures.filter((d) => {
      if (planned.has(d.id)) return false;
      if (f.cycle !== 'all' && d.cycle !== f.cycle) return false;
      if (f.phase !== 'all' && !(d.phases as readonly string[]).includes(f.phase)) return false;
      if (f.risk === 'high' && !high.some((k) => answers(d, k))) return false;
      if (f.risk === 'uncovered' && !uncovered.some((k) => answers(d, k))) return false;
      if (words.length && !words.every((w) => fold(`${d.title} ${d.objective}`).includes(w))) return false;
      return true;
    });
  }, [params, f, planned, planning, program]);
  return (
    <Card title="Bibliothèque de procédures" actions={<span className="text-xs text-muted">{list.length} procédure{list.length > 1 ? 's' : ''} hors programme</span>}>
      <div className="grid gap-2 border-b border-line px-3 py-2 sm:grid-cols-2 lg:grid-cols-4">
        <Field id="lib-cycle" label="Cycle">
          <Select id="lib-cycle" value={f.cycle} onChange={(e) => setLibrary({ cycle: e.target.value })} className="w-full">
            <option value="all">Tous les cycles</option>
            {params.cycles.cycles.map((cy) => (
              <option key={cy.id} value={cy.id}>
                {cy.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="lib-risk" label="Risques">
          <Select id="lib-risk" value={f.risk} onChange={(e) => setLibrary({ risk: e.target.value as typeof f.risk })} className="w-full">
            <option value="all">Toutes les procédures</option>
            <option value="high">Couvrant vos risques élevés</option>
            <option value="uncovered">Répondant à vos risques non couverts</option>
          </Select>
        </Field>
        <Field id="lib-phase" label="Phase">
          <Select id="lib-phase" value={f.phase} onChange={(e) => setLibrary({ phase: e.target.value })} className="w-full">
            <option value="all">Toutes les phases</option>
            {['planning', 'interim', 'final', 'completion', 'reporting'].map((p) => (
              <option key={p} value={p}>
                {params.game.calendar.find((x) => x.id === p)?.label ?? p}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="lib-query" label="Recherche">
          <TextInput id="lib-query" type="search" value={f.query} onChange={(e) => setLibrary({ query: e.target.value })} className="w-full" />
        </Field>
        {(f.cycle !== 'all' || f.risk !== 'all' || f.phase !== 'all' || f.query) && (
          <div className="sm:col-span-2 lg:col-span-4">
            <Button variant="ghost" className="px-1.5 py-0 text-xs" onClick={() => setLibrary(DEFAULT_LIBRARY)}>
              Effacer les filtres
            </Button>
          </div>
        )}
      </div>
      <ul className="max-h-[36rem] divide-y divide-line overflow-auto text-sm">
        {list.map((d) => {
          const open = openId === d.id;
          return (
            <li key={d.id} className="px-3 py-1.5">
              <div className="flex flex-wrap items-start gap-2">
                <button type="button" aria-expanded={open} onClick={() => setOpenId(open ? null : d.id)} className="min-w-0 flex-1 text-left hover:text-accent">
                  <span className="font-medium">{d.title}</span> <Flags def={d} />
                  <span className="block text-xs text-muted">
                    {cycleLabel(params, d.cycle)} · {phasesText(params, d)} · {outputText(d)}
                  </span>
                </button>
                <HoursByProfile def={d} />
                <Button className="px-1.5 py-0 text-xs" aria-label={`Ajouter « ${d.title} » au programme`} onClick={() => act((s) => planProcedure(s, params, d.id))}>
                  Ajouter
                </Button>
              </div>
              {open && (
                <div className="mt-1 rounded-md bg-sunken px-3 py-2 text-xs">
                  <p>{d.objective}</p>
                  <ul className="mt-1 list-disc pl-5 text-muted">
                    {d.steps.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          );
        })}
        {list.length === 0 && <li className="px-3 py-4 text-center text-muted">Aucune procédure ne correspond aux filtres.</li>}
      </ul>
    </Card>
  );
}

export function ProgramTab() {
  const c = useCase();
  const params = c.params;
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const check = useMemo(() => programmeCheck(game, params), [game, params]);
  const [confirmFirm, setConfirmFirm] = useState(false);
  const [tried, setTried] = useState(false);
  const manager = params.game.firm.find((f) => f.id === 'manager')?.name ?? 'Le manager';
  const firmHours = useMemo(() => plannedHours({ planned: params.procedures.firmProgramme2024, executions: [] }, params).team, [params]);
  const adopt = () => {
    // confirmation only when the player's own choices would be replaced (the required procedures are kept)
    const own = game.program.planned.some((p) => {
      const def = procedureDef(params, p.procedureId);
      return def !== undefined && !isRequired(def);
    });
    if (own && !confirmFirm) {
      setConfirmFirm(true);
      return;
    }
    setConfirmFirm(false);
    act((s) => adoptFirmProgramme(s, params));
  };
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card title="Point de départ">
          <div className="space-y-2 px-3 py-2 text-sm">
            <p>
              {manager} propose de partir du programme 2024 du cabinet ({params.procedures.firmProgramme2024.length} procédures, {formatHours(firmHours)} h pour l’équipe) : un programme générique, à adapter au dossier, à vos risques et au budget.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={adopt}>{confirmFirm ? 'Confirmer : remplacer le programme' : 'Partir du programme du cabinet'}</Button>
              {confirmFirm && (
                <>
                  <span className="text-xs text-warn">Les procédures non lancées seront remplacées.</span>
                  <Button variant="ghost" className="px-1.5 py-0 text-xs" onClick={() => setConfirmFirm(false)}>
                    Annuler
                  </Button>
                </>
              )}
              <AidButton />
            </div>
          </div>
        </Card>
        <Card title="Prévisionnel et budget">
          <BudgetSummary />
        </Card>
      </div>
      <Card
        title="Programme de travail"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {game.planning.validated.program && <span className="text-xs text-muted">Validé le {formatDateFr(game.planning.validated.program)}</span>}
            <Button
              variant="primary"
              onClick={() => {
                setTried(true);
                act((s) => validateProgramme(s, params));
              }}
            >
              Valider le programme
            </Button>
          </div>
        }
      >
        {((tried && check.errors.length > 0) || (game.program.planned.length > 0 && check.warnings.length > 0)) && (
          <div className="space-y-1 border-b border-line px-3 py-2 text-sm">
            {tried && check.errors.length > 0 && (
              <ul role="alert" className="list-disc space-y-0.5 pl-5 text-ko">
                {check.errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
            {game.program.planned.length > 0 && check.warnings.length > 0 && (
              <ul className="list-disc space-y-0.5 pl-5 text-warn">
                {check.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        <ProgrammeTable />
        <p className="border-t border-line px-3 py-2 text-xs text-muted">
          Les procédures se lancent depuis l’écran{' '}
          <Link to="/travaux" className="text-accent hover:underline">
            Travaux
          </Link>
          , pendant leurs phases : chacun y consacre {params.game.onSite.capacityHoursPerDay} heures par jour ouvré de présence sur site.
        </p>
      </Card>
      <Library />
    </div>
  );
}
