/**
 * Work programme and executions (plan J4 §6.3 and §7): procedures planned and
 * assigned, then launched (scheduled on the member's working days on site)
 * and documented. The worksheet of a procedure is its execution: preparer,
 * dates (derived from the scheduling), references, conclusion, review fields
 * of J5. Section of the game state owned by J4b.
 *
 * Hours are the budget: an execution charges the procedure's cost for the
 * assignee's profile. Beyond the tolerance of the budget, the partner
 * arbitrates (record, and a gauge event when the overrun is not justified by
 * a risk assessed high or an open finding).
 */
import { z } from 'zod';
import { formatDateFr, type IsoDate } from '../engine/dates';
import type { DocumentModel } from '../scenario/documents';
import type { Params } from '../scenario/params';
import type { CompletionCriterion, ProcedureDef, ProfileId } from '../scenario/schemas/procedures';
import type { UpcomingContext, UpcomingEvent } from './advance';
import { hoursUsed, type HoursCharge } from './budget';
import { nextOnSiteDay, periodIdAt, schedule, type MemberId, type ScheduledTask, type WorkCalendar } from './calendar';
import { evaluateAll, type ConditionContext, type ProcedureProgress } from './conditions';
import type { FindingsState } from './findings';
import { recordGaugeEvent } from './gauges';
import { maxRiskOfCycle, planningThreshold, riskRank, uncoveredRisks } from './planning';
import { log, nextId, type GameState } from './state';
import { annexCells, statementCells, STATEMENT_ORDER, type AnnexTableShape } from './ticking';

export interface PlannedProcedure {
  procedureId: string;
  assignee: MemberId;
}

/** Reference pinned on a worksheet by the player. */
export type WorkRef = { kind: 'doc'; id: string; block?: number } | { kind: 'query' | 'sample' | 'recalc' | 'request' | 'finding' | 'confirmation'; id: string };

export interface Execution {
  id: string;
  procedureId: string;
  assignee: MemberId;
  /** Hours charged (cost of the procedure for the assignee). */
  hours: number;
  launchedOn: IsoDate;
  /** Conclusion of the worksheet (params/procedures.json → conclusions), null until documented. */
  conclusion: string | null;
  comment: string;
  documentedOn?: IsoDate;
  /** Last update of the worksheet after its documentation (subsequent events: update at the signature). */
  updatedOn?: IsoDate;
  /** References pinned by the player (the references produced by the tools are derived). */
  refs: WorkRef[];
  /** Review by the senior (J5): accepted or returned with a comment. */
  review: { status: 'pending' | 'accepted' | 'returned'; on?: IsoDate; comment?: string };
}

export interface ProgramState {
  planned: PlannedProcedure[];
  /** In launch order (scheduling order). */
  executions: Execution[];
}

export function initialProgram(): ProgramState {
  return { planned: [], executions: [] };
}

const member = z.enum(['senior', 'lea', 'hugo', 'sofia']);
const workRef = z.union([
  z.object({ kind: z.literal('doc'), id: z.string(), block: z.number().int().optional() }),
  z.object({ kind: z.enum(['query', 'sample', 'recalc', 'request', 'finding', 'confirmation']), id: z.string() }),
]);
export const programSchema = z.object({
  planned: z.array(z.object({ procedureId: z.string(), assignee: member })),
  executions: z.array(
    z.object({
      id: z.string(),
      procedureId: z.string(),
      assignee: member,
      hours: z.number(),
      launchedOn: z.string(),
      conclusion: z.string().nullable(),
      comment: z.string(),
      documentedOn: z.string().optional(),
      updatedOn: z.string().optional(),
      refs: z.array(workRef).default([]),
      review: z.object({ status: z.enum(['pending', 'accepted', 'returned']), on: z.string().optional(), comment: z.string().optional() }),
    }),
  ),
});

// ---------------------------------------------------------------------------
// procedures and profiles
// ---------------------------------------------------------------------------

export const TEAM: readonly MemberId[] = ['senior', 'lea', 'hugo', 'sofia'];

export function procedureDef(params: Params, id: string): ProcedureDef | undefined {
  return params.procedures.procedures.find((p) => p.id === id);
}

export function profileOf(params: Params, m: MemberId): ProfileId {
  return params.procedures.profiles[m];
}

/** Hours of a procedure for a member (undefined: the member's profile cannot run it). */
export function procedureHours(def: ProcedureDef, m: MemberId, params: Params): number | undefined {
  return def.hours[profileOf(params, m)];
}

export function allowedMembers(def: ProcedureDef, params: Params): MemberId[] {
  return TEAM.filter((m) => procedureHours(def, m, params) !== undefined);
}

/** Senior when allowed, otherwise the first member whose profile can run the procedure. */
export function defaultAssignee(def: ProcedureDef, params: Params): MemberId {
  return allowedMembers(def, params)[0] ?? 'senior';
}

export function memberName(params: Params, m: MemberId): string {
  return params.game.team.find((t) => t.id === m)?.name ?? m;
}

/** A procedure cannot be removed from the programme when it is mandatory or a response to management override. */
export function isRequired(def: ProcedureDef): boolean {
  return def.mandatory !== undefined || def.overrideResponse === true;
}

// ---------------------------------------------------------------------------
// programme
// ---------------------------------------------------------------------------

function withProgram(s: GameState, program: ProgramState): GameState {
  return { ...s, program };
}

/** French subject of a journal event on a procedure (desk journal: `data.title`). */
function procTitle(params: Params | undefined, procedureId: string): string {
  return (params && procedureDef(params, procedureId)?.title) || procedureId;
}

export function planProcedure(s: GameState, params: Params, procedureId: string, assignee?: MemberId): GameState {
  const def = procedureDef(params, procedureId);
  if (!def || s.program.planned.some((p) => p.procedureId === procedureId)) return s;
  const m = assignee && procedureHours(def, assignee, params) !== undefined ? assignee : defaultAssignee(def, params);
  return log(withProgram(s, { ...s.program, planned: [...s.program.planned, { procedureId, assignee: m }] }), 'program', procedureId, { action: 'plan', assignee: m, title: `« ${def.title} » ajoutée (${memberName(params, m)})` });
}

/** Removes a procedure from the programme (refused for the mandatory ones, the override responses and the launched ones). */
export function unplanProcedure(s: GameState, params: Params, procedureId: string): GameState {
  const def = procedureDef(params, procedureId);
  if (def && isRequired(def)) return s;
  if (s.program.executions.some((e) => e.procedureId === procedureId)) return s;
  if (!s.program.planned.some((p) => p.procedureId === procedureId)) return s;
  return log(withProgram(s, { ...s.program, planned: s.program.planned.filter((p) => p.procedureId !== procedureId) }), 'program', procedureId, { action: 'unplan', title: `« ${procTitle(params, procedureId)} » retirée` });
}

export function assignProcedure(s: GameState, params: Params, procedureId: string, m: MemberId): GameState {
  const def = procedureDef(params, procedureId);
  if (!def || procedureHours(def, m, params) === undefined) return s;
  const planned = s.program.planned.map((p) => (p.procedureId === procedureId ? { ...p, assignee: m } : p));
  if (planned.every((p, i) => p === s.program.planned[i])) return s;
  return log(withProgram(s, { ...s.program, planned }), 'program', procedureId, { action: 'assign', assignee: m, title: `« ${def.title} » confiée à ${memberName(params, m)}` });
}

/** Starts from the firm's 2024 programme (plan J4 §6.3): it replaces the planned procedures not yet launched; the override responses are kept. */
export function adoptFirmProgramme(s: GameState, params: Params): GameState {
  const launched = new Set(s.program.executions.map((e) => e.procedureId));
  const kept = s.program.planned.filter((p) => {
    const def = procedureDef(params, p.procedureId);
    return launched.has(p.procedureId) || (def !== undefined && isRequired(def));
  });
  const keptIds = new Set(kept.map((p) => p.procedureId));
  const firm = params.procedures.firmProgramme2024.filter((f) => !keptIds.has(f.procedureId)).map((f) => ({ procedureId: f.procedureId, assignee: f.assignee }));
  return log(withProgram(s, { ...s.program, planned: [...kept, ...firm] }), 'program', 'firmProgramme2024', { action: 'adopt', title: 'reprise du programme 2024 du cabinet' });
}

export interface PlannedHours {
  byMember: Record<MemberId, number>;
  /** Senior, Léa and Hugo. */
  team: number;
  itAuditor: number;
}

/** Hours of the programme by member (planned procedures at the assignee's cost). */
export function plannedHours(program: ProgramState, params: Params): PlannedHours {
  const byMember: Record<MemberId, number> = { senior: 0, lea: 0, hugo: 0, sofia: 0 };
  for (const p of program.planned) {
    const def = procedureDef(params, p.procedureId);
    const h = def ? procedureHours(def, p.assignee, params) : undefined;
    if (h !== undefined) byMember[p.assignee] += h;
  }
  return { byMember, team: byMember.senior + byMember.lea + byMember.hugo, itAuditor: byMember.sofia };
}

export interface ProgrammeCheck {
  /** Block the validation. */
  errors: string[];
  /** Shown, not blocking (budget, uncovered risks). */
  warnings: string[];
}

export function programmeCheck(s: GameState, params: Params): ProgrammeCheck {
  const errors: string[] = [];
  const warnings: string[] = [];
  const planned = new Set(s.program.planned.map((p) => p.procedureId));
  if (planned.size === 0) errors.push('Le programme est vide : partez du programme du cabinet ou choisissez des procédures dans la bibliothèque.');
  for (const def of params.procedures.procedures) {
    if (def.mandatory && !planned.has(def.id)) errors.push(`Diligence obligatoire absente du programme : « ${def.title} ».`);
    else if (def.overrideResponse && !planned.has(def.id)) errors.push(`Réponse obligatoire au risque de contournement des contrôles absente : « ${def.title} ».`);
  }
  for (const p of s.program.planned) {
    const def = procedureDef(params, p.procedureId);
    if (def && procedureHours(def, p.assignee, params) === undefined) errors.push(`« ${def.title} » ne peut pas être confiée à ${memberName(params, p.assignee)}.`);
  }
  const h = plannedHours(s.program, params);
  const budget = params.game.budgetHours[s.difficulty];
  if (h.team > budget) warnings.push(`Le prévisionnel (${fmtHours(h.team)} h) dépasse le budget de la mission (${budget} h).`);
  const sofia = params.game.team.find((t) => t.id === 'sofia')?.hoursByDifficulty[s.difficulty] ?? 0;
  if (h.itAuditor > sofia) warnings.push(`Le prévisionnel de l’auditrice des systèmes d’information (${fmtHours(h.itAuditor)} h) dépasse son enveloppe (${sofia} h).`);
  for (const r of uncoveredRisks(s.planning, s.program, params)) warnings.push(`Risque sans réponse au programme : ${r.label}.`);
  return { errors, warnings };
}

/** Validates the programme (desk checklist); refused while a mandatory diligence is missing. */
export function validateProgramme(s: GameState, params: Params): GameState {
  if (programmeCheck(s, params).errors.length) return s;
  return log({ ...s, planning: { ...s.planning, validated: { ...s.planning.validated, program: s.clock.date } } }, 'program', 'validated', { action: 'validate', title: 'programme validé' });
}

function fmtHours(h: number): string {
  return h.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
}

// ---------------------------------------------------------------------------
// executions: scheduling and status
// ---------------------------------------------------------------------------

/** Start and end dates of every execution (each member's work in launch order, at the daily capacity on site). */
export function scheduleExecutions(program: ProgramState, cal: WorkCalendar): Map<string, ScheduledTask> {
  const tasks = program.executions.map((e) => ({ id: e.id, member: e.assignee, hours: e.hours, earliest: e.launchedOn }));
  return new Map(schedule(cal, tasks).map((t) => [t.id, t]));
}

/** Start and delivery dates a launch would get today (after the member's queue), without launching it. */
export function previewLaunch(program: ProgramState, cal: WorkCalendar, m: MemberId, hours: number, date: IsoDate): ScheduledTask {
  const id = '\u0000preview';
  const probe: Execution = { id, procedureId: '', assignee: m, hours, launchedOn: date, conclusion: null, comment: '', refs: [], review: { status: 'pending' } };
  return scheduleExecutions({ ...program, executions: [...program.executions, probe] }, cal).get(id)!;
}

export type ExecutionStatus = 'waiting' | 'inProgress' | 'delivered' | 'documented' | 'unfinishable';

export const EXECUTION_STATUS_LABEL: Record<ExecutionStatus, string> = {
  waiting: 'Planifiée',
  inProgress: 'En cours',
  delivered: 'Livrée, à documenter',
  documented: 'Documentée',
  unfinishable: 'Ne peut pas être terminée',
};

export function executionStatus(e: Execution, t: ScheduledTask | undefined, date: IsoDate): ExecutionStatus {
  if (!t || t.start === null) return 'unfinishable';
  if (e.conclusion !== null && t.end !== null && t.end <= date) return 'documented';
  if (t.end !== null && t.end <= date) return 'delivered';
  if (t.start > date) return 'waiting';
  return t.end === null ? 'unfinishable' : 'inProgress';
}

/** Progress of each procedure (conditions of the other procedures and of J5). */
export function procedureProgress(program: ProgramState, cal: WorkCalendar, date: IsoDate): (procedureId: string) => ProcedureProgress {
  const sched = scheduleExecutions(program, cal);
  return (id) => {
    let best: ProcedureProgress = 'none';
    const rank = { none: 0, launched: 1, delivered: 2, documented: 3 } as const;
    for (const e of program.executions) {
      if (e.procedureId !== id || e.launchedOn > date) continue;
      const st = executionStatus(e, sched.get(e.id), date);
      const p: ProcedureProgress = st === 'documented' ? 'documented' : st === 'delivered' ? 'delivered' : 'launched';
      if (rank[p] > rank[best]) best = p;
    }
    return best;
  };
}

export function executionOf(program: ProgramState, procedureId: string): Execution | undefined {
  return program.executions.find((e) => e.procedureId === procedureId);
}

// ---------------------------------------------------------------------------
// launching
// ---------------------------------------------------------------------------

export interface LaunchContext extends ConditionContext {
  cal: WorkCalendar;
}

export interface LaunchCheck {
  ok: boolean;
  /** Why the launch is refused (French). */
  reasons: string[];
}

const PHASE_TEXT: Record<string, string> = { planning: 'la planification', interim: 'l’intérim', final: 'le final', completion: 'la synthèse', reporting: 'la période du rapport' };

/** Phases of a procedure in a sentence (« l’intérim ou le final »). */
export function phaseList(def: ProcedureDef): string {
  const t = def.phases.map((p) => PHASE_TEXT[p] ?? p);
  return t.length > 1 ? `${t.slice(0, -1).join(', ')} ou ${t[t.length - 1]}` : (t[0] ?? '');
}

/** Phase labels of a procedure (calendar periods). */
export function phaseLabels(def: ProcedureDef, params: Params): string[] {
  return def.phases.map((id) => params.game.calendar.find((c) => c.id === id)?.label ?? id);
}

/**
 * Can the procedure be launched now by this member? The game date (or the
 * member's next day on site) must be in one of the procedure's phases, the
 * member's profile must be able to run it, and its prerequisites must be met.
 */
export function canLaunch(s: GameState, params: Params, procedureId: string, m: MemberId, ctx: LaunchContext): LaunchCheck {
  const def = procedureDef(params, procedureId);
  if (!def) return { ok: false, reasons: ['Procédure inconnue.'] };
  const reasons: string[] = [];
  if (executionOf(s.program, procedureId)) reasons.push('La procédure a déjà été lancée.');
  if (procedureHours(def, m, params) === undefined) reasons.push(`Cette procédure ne peut pas être confiée à ${memberName(params, m)}.`);
  // the work starts on the member's next day on site: that day must be in one of the procedure's phases
  const firstDay = nextOnSiteDay(ctx.cal, m, ctx.date);
  const startPeriod = firstDay ? periodIdAt(ctx.cal, firstDay) : undefined;
  const phases = def.phases as readonly string[];
  const who = m === 'senior' ? 'vous n’êtes' : `${memberName(params, m)} n’est`;
  if (!firstDay) reasons.push(`${m === 'senior' ? 'Vous n’êtes' : `${memberName(params, m)} n’est`} plus sur site d’ici la fin de la mission.`);
  else if (startPeriod === undefined || !phases.includes(startPeriod))
    reasons.push(`Procédure à mener pendant ${phaseList(def)}${firstDay > ctx.date ? ` ; ${who} sur site qu’à partir du ${formatDateFr(firstDay)}` : ''}.`);
  reasons.push(...evaluateAll(def.requires, ctx).reasons);
  return { ok: reasons.length === 0, reasons };
}

/** Sum of the debit lines of a finding's proposed entry (its amount). */
function findingAmount(f: FindingsState['items'][number]): number {
  return f.proposedEntry.reduce((a, l) => a + l.debit, 0);
}

/** An overrun is justified by a cycle assessed high (before the launch) or an open finding of the cycle at least equal to the planning materiality (J4-4). */
export function overrunJustified(s: GameState, cycle: string): boolean {
  if (riskRank(maxRiskOfCycle(s.planning, cycle)) >= riskRank('high')) return true;
  const threshold = planningThreshold(s.planning);
  if (threshold === null) return false;
  return s.findings.items.some((f) => f.cycle === cycle && (f.status === 'question' || f.status === 'finding') && findingAmount(f) >= threshold);
}

export const UNJUSTIFIED_OVERRUN = 'unjustifiedOverrun';

export interface BudgetImpact {
  /** Team hours charged before and after the launch. */
  before: number;
  after: number;
  budget: number;
  /** Budget plus the tolerance: beyond it, the partner arbitrates. */
  limit: number;
  /** The launch takes the team beyond the tolerance (the partner arbitrates). */
  arbitration: boolean;
  /** The overrun is justified (risk assessed high or open finding of the cycle, J4-4). */
  justified: boolean;
}

/**
 * Effect of launching a procedure on the team budget (null for the IT
 * auditor, whose hours are a separate envelope). Shown before the launch, so
 * that the player knows when the partner will arbitrate.
 */
export function launchBudgetImpact(s: GameState, params: Params, procedureId: string, m: MemberId): BudgetImpact | null {
  const def = procedureDef(params, procedureId);
  const hours = def ? procedureHours(def, m, params) : undefined;
  if (!def || hours === undefined || m === 'sofia') return null;
  const budget = params.game.budgetHours[s.difficulty];
  const limit = budget * (1 + params.game.overrunTolerancePct / 100);
  const before = hoursUsed(s, params).team;
  const after = before + hours;
  const arbitration = after > limit + 1e-9;
  return { before, after, budget, limit, arbitration, justified: arbitration && overrunJustified(s, def.cycle) };
}

/**
 * Launches a procedure: it joins the queue of the member (scheduled on the
 * member's working days on site) and charges its hours. Beyond the budget
 * tolerance, the partner arbitrates.
 */
export function launchExecution(s: GameState, params: Params, procedureId: string, m: MemberId, ctx: LaunchContext): GameState {
  if (!canLaunch(s, params, procedureId, m, ctx).ok) return s;
  const def = procedureDef(params, procedureId)!;
  const hours = procedureHours(def, m, params)!;
  const impact = launchBudgetImpact(s, params, procedureId, m);
  const [id, s1] = nextId(s, 'exec');
  const e: Execution = { id, procedureId, assignee: m, hours, launchedOn: s1.clock.date, conclusion: null, comment: '', refs: [], review: { status: 'pending' } };
  const planned = s1.program.planned.some((p) => p.procedureId === procedureId)
    ? s1.program.planned.map((p) => (p.procedureId === procedureId ? { ...p, assignee: m } : p))
    : [...s1.program.planned, { procedureId, assignee: m }];
  let next = log(withProgram(s1, { planned, executions: [...s1.program.executions, e] }), 'execution', procedureId, {
    action: 'launch',
    assignee: m,
    hours,
    title: `« ${def.title} » lancée (${memberName(params, m)}, ${fmtHours(hours)} h)`,
  });
  // budget: arbitration of the partner beyond the tolerance
  if (impact?.arbitration) {
    const { justified } = impact;
    const overrun = Math.round((impact.after - impact.budget) * 10) / 10;
    const gauges = { ...next.gauges, arbitrations: [...next.gauges.arbitrations, { on: next.clock.date, overrunHours: overrun, justified }] };
    next = log({ ...next, gauges: justified ? gauges : recordGaugeEvent(gauges, { on: next.clock.date, gauge: 'partnerTrust', reason: UNJUSTIFIED_OVERRUN, ref: procedureId }) }, 'arbitration', procedureId, {
      justified,
      overrun,
      title: `arbitrage de l’associée : dépassement du budget de ${fmtHours(overrun)} h, ${justified ? 'justifié par le risque du cycle' : 'non justifié'}`,
    });
  }
  return next;
}

/** Cancels an execution not yet started (its hours are given back). */
export function cancelExecution(s: GameState, executionId: string, cal: WorkCalendar, params?: Params): GameState {
  const e = s.program.executions.find((x) => x.id === executionId);
  if (!e) return s;
  const t = scheduleExecutions(s.program, cal).get(executionId);
  if (t && t.start !== null && t.start <= s.clock.date) return s;
  return log(withProgram(s, { ...s.program, executions: s.program.executions.filter((x) => x.id !== executionId) }), 'execution', e.procedureId, { action: 'cancel', title: `« ${procTitle(params, e.procedureId)} » : lancement annulé` });
}

function withExecution(s: GameState, id: string, f: (e: Execution) => Execution): GameState {
  return withProgram(s, { ...s.program, executions: s.program.executions.map((e) => (e.id === id ? f(e) : e)) });
}

/** Documents the worksheet (conclusion from the list and comment), once delivered. */
export function documentExecution(s: GameState, params: Params, executionId: string, conclusion: string, comment: string, cal: WorkCalendar): GameState {
  const e = s.program.executions.find((x) => x.id === executionId);
  if (!e || !params.procedures.conclusions.some((c) => c.id === conclusion)) return s;
  const st = executionStatus(e, scheduleExecutions(s.program, cal).get(executionId), s.clock.date);
  if (st !== 'delivered' && st !== 'documented') return s;
  const updated = e.conclusion !== null;
  const next = withExecution(s, executionId, (x) => ({ ...x, conclusion, comment: comment.trim(), ...(updated ? { updatedOn: s.clock.date } : { documentedOn: s.clock.date }) }));
  const label = params.procedures.conclusions.find((c) => c.id === conclusion)?.label ?? conclusion;
  return log(next, 'worksheet', e.procedureId, { action: updated ? 'update' : 'document', conclusion, title: `« ${procTitle(params, e.procedureId)} » ${updated ? 'mise à jour' : 'documentée'} : ${label.toLowerCase()}` });
}

/** Records an update of a documented worksheet (subsequent events: update up to the signature). */
export function updateExecution(s: GameState, executionId: string, params?: Params): GameState {
  const e = s.program.executions.find((x) => x.id === executionId);
  if (!e || e.conclusion === null) return s;
  return log(withExecution(s, executionId, (x) => ({ ...x, updatedOn: s.clock.date })), 'worksheet', e.procedureId, { action: 'update', title: `« ${procTitle(params, e.procedureId)} » mise à jour` });
}

function sameRef(a: WorkRef, b: WorkRef): boolean {
  return a.kind === b.kind && a.id === b.id && (a.kind === 'doc' && b.kind === 'doc' ? a.block === b.block : true);
}

export function addExecutionRef(s: GameState, executionId: string, ref: WorkRef): GameState {
  const e = s.program.executions.find((x) => x.id === executionId);
  if (!e || e.refs.some((r) => sameRef(r, ref))) return s;
  return withExecution(s, executionId, (x) => ({ ...x, refs: [...x.refs, ref] }));
}

export function removeExecutionRef(s: GameState, executionId: string, ref: WorkRef): GameState {
  return withExecution(s, executionId, (x) => ({ ...x, refs: x.refs.filter((r) => !sameRef(r, ref)) }));
}

/** Review of a delegated worksheet by the senior (fields of J5; no effect in J4). */
export function reviewExecution(s: GameState, executionId: string, status: 'accepted' | 'returned', comment: string, params?: Params): GameState {
  const e = s.program.executions.find((x) => x.id === executionId);
  if (!e || e.assignee === 'senior') return s;
  const review = { status, on: s.clock.date, ...(comment.trim() ? { comment: comment.trim() } : {}) };
  return log(withExecution(s, executionId, (x) => ({ ...x, review })), 'worksheet', e.procedureId, { action: 'review', status, title: `« ${procTitle(params, e.procedureId)} » ${status === 'accepted' ? 'acceptée' : 'renvoyée'} en revue` });
}

// ---------------------------------------------------------------------------
// references, completion, form check
// ---------------------------------------------------------------------------

/** References produced by the work of an execution (derived, never stored). */
export function derivedRefs(e: Execution, def: ProcedureDef, s: Pick<GameState, 'samples' | 'recalcs' | 'requests' | 'savedQueries' | 'documents' | 'confirmations'>): WorkRef[] {
  const refs: WorkRef[] = [];
  for (const x of s.samples.items) if (x.executionId === e.id) refs.push({ kind: 'sample', id: x.id });
  for (const x of s.recalcs.items) if (x.executionId === e.id) refs.push({ kind: 'recalc', id: x.id });
  const o = def.output;
  if (o.kind === 'requests')
    for (const r of s.requests.items) if (o.requests.some((q) => q.family === r.family && (q.object ?? '') === r.object)) refs.push({ kind: 'request', id: r.id });
  if (o.kind === 'confirmations') for (const c of s.confirmations.items) refs.push({ kind: 'confirmation', id: c.thirdParty });
  if (o.kind === 'view' && o.screen === '/fec') for (const q of s.savedQueries) if (q.createdOn >= e.launchedOn) refs.push({ kind: 'query', id: q.id });
  if (o.kind === 'view' && o.screen === '/ged')
    for (const [docId, d] of Object.entries(s.documents)) if (d.annotations.some((a) => a.createdOn >= e.launchedOn)) refs.push({ kind: 'doc', id: docId });
  return refs;
}

export interface CompletionContext {
  params: Params;
  date: IsoDate;
  state: Pick<GameState, 'ticks' | 'savedQueries' | 'samples' | 'recalcs' | 'requests' | 'confirmations' | 'documents'>;
  /** Requests answered at the date. */
  answered: ReadonlySet<string>;
  /** Tables of the annex (cells of the annex ticking), when known. */
  annexTables?: readonly AnnexTableShape[];
  /** Documents available at the date (read criterion), when known. */
  availableDocs?: readonly { id: string; category: string }[];
}

export interface CompletionItem {
  label: string;
  ok: boolean;
}

export interface Completion {
  done: boolean;
  items: CompletionItem[];
}

const QUERY_CRITERIA_LABEL: Record<string, string> = {
  validatedAfterClosing: 'validation après la clôture',
  users: 'utilisateurs',
  roundMultiple: 'montants ronds',
  rarePairsMax: 'couples de comptes inhabituels',
  weekend: 'week-ends',
  missingPiece: 'absence de pièce',
  keywords: 'mots-clés',
};

function queryCovers(q: GameState['savedQueries'][number]['query'], criterion: string): boolean {
  switch (criterion) {
    case 'validatedAfterClosing':
      return q.validatedAfterClosing;
    case 'users':
      return q.users.length > 0;
    case 'roundMultiple':
      return q.roundMultiple > 0;
    case 'rarePairsMax':
      return q.rarePairsMax > 0;
    case 'weekend':
      return q.weekend !== 'none';
    case 'missingPiece':
      return q.missingPiece;
    case 'keywords':
      return q.keywords.trim().length > 0;
    default:
      return false;
  }
}

function pct(n: number, total: number): number {
  return total === 0 ? 0 : (100 * n) / total;
}

function fmtPct(x: number): string {
  return `${Math.floor(x).toLocaleString('fr-FR')} %`;
}

function criterionItem(c: CompletionCriterion, e: Execution, def: ProcedureDef, ctx: CompletionContext): CompletionItem {
  const st = ctx.state;
  switch (c.kind) {
    case 'queries': {
      const covered = c.criteria.filter((k) => st.savedQueries.some((q) => queryCovers(q.query, k)));
      return { label: `Requêtes enregistrées couvrant au moins ${c.min} critères usuels (${c.criteria.map((k) => QUERY_CRITERIA_LABEL[k] ?? k).join(', ')}) : ${covered.length}/${c.min}`, ok: covered.length >= c.min };
    }
    case 'ticks': {
      const defs = ctx.params.statements;
      let cells: string[] = [];
      let what = '';
      if (c.scope === 'comparative') {
        cells = STATEMENT_ORDER.flatMap((x) => statementCells(defs, x)).filter((k) => k.endsWith(':n-1'));
        what = 'cases de la colonne de l’exercice précédent pointées';
      } else if (c.scope === 'statements') {
        cells = STATEMENT_ORDER.flatMap((x) => statementCells(defs, x)).filter((k) => !k.endsWith(':n-1'));
        what = 'cases des états financiers pointées';
      } else {
        const tables = (ctx.annexTables ?? []).filter((t) => !c.table || t.id === c.table);
        cells = annexCells(tables);
        what = c.table ? 'cases du tableau de l’annexe pointées' : 'cases de l’annexe pointées';
      }
      const ticked = cells.filter((k) => st.ticks[k] !== undefined).length;
      const p = pct(ticked, cells.length);
      return { label: `Au moins ${fmtPct(c.minPct)} des ${what} : ${cells.length ? fmtPct(p) : 'non disponible'}`, ok: cells.length > 0 && p >= c.minPct };
    }
    case 'sample': {
      const samples = st.samples.items.filter((x) => x.executionId === e.id);
      const marked = samples.some((x) => x.items.length > 0 && x.items.every((it) => st.ticks[`sample:${x.id}:${it}`] !== undefined));
      return { label: samples.length === 0 ? 'Échantillon tiré dans la procédure' : 'Tous les éléments de l’échantillon examinés et marqués', ok: marked };
    }
    case 'recalc':
      return { label: 'Recalcul effectué dans la procédure', ok: st.recalcs.items.some((x) => x.executionId === e.id) };
    case 'requests': {
      const reqs = def.output.kind === 'requests' ? def.output.requests : [];
      const n = reqs.filter((r) => ctx.answered.has(r.object ? `${r.family}:${r.object}` : r.family)).length;
      return { label: `Pièces demandées reçues : ${n}/${reqs.length}`, ok: reqs.length > 0 && n === reqs.length };
    }
    case 'confirmations': {
      const n = st.confirmations.items.length;
      return { label: `Demandes de confirmation préparées : ${n} (au moins ${c.min})`, ok: n >= c.min };
    }
    case 'read': {
      const docs = (ctx.availableDocs ?? []).filter((d) => d.category === c.category);
      const read = docs.filter((d) => st.documents[d.id]?.readOn !== undefined).length;
      const p = pct(read, docs.length);
      return { label: `Au moins ${fmtPct(c.minPct)} des pièces de la rubrique lues : ${docs.length ? `${read}/${docs.length}` : 'non disponible'}`, ok: docs.length > 0 && p >= c.minPct };
    }
    case 'updated': {
      const from = ctx.params.game.calendar.find((p) => p.id === c.fromPeriod)?.from ?? '9999-12-31';
      return { label: `Mise à jour à partir du ${formatDateFr(from)}, jusqu’à la signature du rapport`, ok: e.updatedOn !== undefined && e.updatedOn >= from };
    }
  }
}

/** Completion of a worksheet: delivered, the real work of its criterion done, documented (plan J4 §7.3). */
export function completionOf(e: Execution, def: ProcedureDef, status: ExecutionStatus, ctx: CompletionContext): Completion {
  const items: CompletionItem[] = [{ label: 'Feuille de travail livrée', ok: status === 'delivered' || status === 'documented' }];
  for (const c of def.completion) items.push(criterionItem(c, e, def, ctx));
  items.push({ label: 'Conclusion documentée', ok: e.conclusion !== null });
  return { done: items.every((i) => i.ok), items };
}

/** Manager's form check (plan J4 §7.3): a delivered worksheet without conclusion or without reference is flagged; it reveals nothing. */
export function formCheck(e: Execution, status: ExecutionStatus, refs: readonly WorkRef[]): string[] {
  if (status !== 'delivered' && status !== 'documented') return [];
  const out: string[] = [];
  if (e.conclusion === null) out.push('Feuille livrée sans conclusion.');
  if (refs.length === 0) out.push('Feuille sans référence : liez les pièces, requêtes ou travaux qui fondent la conclusion.');
  return out;
}

// ---------------------------------------------------------------------------
// delegated work (§7): correct in J4, the faulty variants T1 to T4 come in J5
// ---------------------------------------------------------------------------

export interface DelegatedWorksheet {
  preparer: MemberId;
  /** Documents examined where the member noted points for the senior (blocks of the document). */
  points: { docId: string; title: string; blocks: number[] }[];
  /** Conclusion proposed by the member. */
  proposed: 'exceptions' | 'satisfactory';
}

/**
 * Worksheet prepared by Léa or Hugo (plan J4 §7.1 « delegated »): drawn from
 * the key — the documents available at the delivery date that carry clues of
 * the parts the procedure can reveal, and the conclusion. Null for the
 * senior's own work and before the delivery.
 */
export function delegatedWorksheet(e: Execution, def: ProcedureDef, status: ExecutionStatus, documents: readonly DocumentModel[], isAvailable: (d: DocumentModel) => boolean): DelegatedWorksheet | null {
  if (e.assignee !== 'lea' && e.assignee !== 'hugo') return null;
  if (status !== 'delivered' && status !== 'documented') return null;
  const parts = new Set(def.effectiveFor);
  const anomalies = new Set(def.effectiveFor.map((p) => p.split('.')[0]!));
  const points: DelegatedWorksheet['points'] = [];
  for (const d of documents) {
    const clues = d.clues.filter((c) => anomalies.has(c.target) && (!c.parts || c.parts.some((p) => parts.has(p)) || parts.has(c.target)));
    if (clues.length === 0 || !isAvailable(d)) continue;
    const ids = new Set(clues.map((c) => c.id));
    const blocks = d.blocks.flatMap((b, i) => (blockClues(b).some((c) => ids.has(c)) ? [i] : []));
    points.push({ docId: d.id, title: d.title, blocks });
  }
  return { preparer: e.assignee, points, proposed: points.length ? 'exceptions' : 'satisfactory' };
}

function blockClues(b: DocumentModel['blocks'][number]): string[] {
  switch (b.kind) {
    case 'fields':
      return b.rows.flatMap((r) => (r.clue ? [r.clue] : []));
    case 'table':
      return b.rows.flatMap((r) => (r.clue ? [r.clue] : []));
    case 'list':
      return b.items.flatMap((r) => (r.clue ? [r.clue] : []));
    case 'signature':
      return [];
    default:
      return b.clue ? [b.clue] : [];
  }
}

// ---------------------------------------------------------------------------
// clock and budget
// ---------------------------------------------------------------------------

/** Upcoming events of the programme: worksheets delivered at the end of their scheduling. */
export function upcomingProgram(s: ProgramState, ctx: UpcomingContext): UpcomingEvent[] {
  const sched = scheduleExecutions(s, ctx.cal);
  const out: UpcomingEvent[] = [];
  for (const e of s.executions) {
    const t = sched.get(e.id);
    if (!t?.end || t.end <= ctx.date) continue;
    const title = procedureDef(ctx.params, e.procedureId)?.title ?? e.procedureId;
    out.push({ date: t.end, kind: 'delivery', label: `Feuille de travail livrée : ${title} (${memberName(ctx.params, e.assignee)})`, to: '/travaux' });
  }
  return out;
}

/** Hours charged to the budget by the executions of the procedures (cost of the procedure for the assignee). */
export function hoursCharged(s: ProgramState, _params: Params): HoursCharge[] {
  return s.executions.map((e) => ({ member: e.assignee, hours: e.hours, on: e.launchedOn }));
}
