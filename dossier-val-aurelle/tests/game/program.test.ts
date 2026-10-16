/** Work programme, executions, completion, conditions and Antoine's advice (plan J4 §6.3, §7, §14, §16). Pure rules. */
import { describe, expect, it } from 'vitest';
import { advanceTo } from '../../src/game/advance';
import { AID_USED, aidMode, antoineAdvice, askAntoine } from '../../src/game/aid';
import { hoursUsed } from '../../src/game/budget';
import { workCalendar } from '../../src/game/calendar';
import { conditionContext, evaluate, evaluateAll } from '../../src/game/conditions';
import { EMPTY_QUERY } from '../../src/game/fec-query';
import { deserialize, serialize } from '../../src/game/persistence';
import { setRisk } from '../../src/game/planning';
import {
  addExecutionRef,
  adoptFirmProgramme,
  allowedMembers,
  assignProcedure,
  cancelExecution,
  canLaunch,
  completionOf,
  delegatedWorksheet,
  derivedRefs,
  documentExecution,
  executionStatus,
  formCheck,
  hoursCharged,
  launchExecution,
  plannedHours,
  planProcedure,
  procedureDef,
  procedureProgress,
  programmeCheck,
  removeExecutionRef,
  reviewExecution,
  scheduleExecutions,
  unplanProcedure,
  UNJUSTIFIED_OVERRUN,
  upcomingProgram,
  updateExecution,
  validateProgramme,
  type Execution,
  type LaunchContext,
} from '../../src/game/program';
import { initialState, saveQuery, setTick, type GameState } from '../../src/game/state';
import { statementCells, STATEMENT_ORDER } from '../../src/game/ticking';
import type { DocumentModel } from '../../src/scenario/documents';
import { loadParams } from '../../src/scenario/params';

const params = loadParams();
const cal = workCalendar(params);
const fresh = (difficulty: GameState['difficulty'] = 'senior'): GameState => initialState(params, difficulty);
const def = (id: string) => procedureDef(params, id)!;
const ctx = (s: GameState, extra: Partial<LaunchContext> = {}): LaunchContext => ({ ...conditionContext(s, params, s.clock.date, { procedureProgress: procedureProgress(s.program, cal, s.clock.date) }), cal, ...extra });
const launch = (s: GameState, id: string, m: Execution['assignee']) => launchExecution(s, params, id, m, ctx(s));
const statusOf = (s: GameState, e: Execution) => executionStatus(e, scheduleExecutions(s.program, cal).get(e.id), s.clock.date);

describe('programme: plan, assign, firm programme, validation', () => {
  it('plans a procedure for an allowed member, assigns it, refuses to remove a mandatory diligence', () => {
    let s = planProcedure(fresh(), params, 'additions-test', 'hugo');
    expect(s.program.planned).toEqual([{ procedureId: 'additions-test', assignee: 'hugo' }]);
    expect(planProcedure(s, params, 'additions-test')).toBe(s);
    s = assignProcedure(s, params, 'additions-test', 'lea');
    expect(s.program.planned[0]!.assignee).toBe('lea');
    // the intern cannot run a recalculation of the impairment
    expect(allowedMembers(def('impairment-recalc'), params)).toEqual(['senior', 'lea']);
    expect(assignProcedure(s, params, 'additions-test', 'sofia')).toBe(s);
    s = planProcedure(s, params, 'impairment-recalc', 'hugo');
    expect(s.program.planned[1]!.assignee).toBe('senior');
    s = unplanProcedure(s, params, 'additions-test');
    expect(s.program.planned.map((p) => p.procedureId)).toEqual(['impairment-recalc']);
    s = planProcedure(s, params, 'subsequent-events');
    expect(unplanProcedure(s, params, 'subsequent-events')).toBe(s);
  });

  it('starts from the firm programme (≈ 380 h): over the 340 h budget, without the migration review', () => {
    const s = adoptFirmProgramme(fresh(), params);
    const h = plannedHours(s.program, params);
    expect(h.team).toBeGreaterThan(340);
    expect(h.team).toBeLessThan(420);
    expect(s.program.planned.some((p) => p.procedureId === 'migration-review')).toBe(false);
    const check = programmeCheck(s, params);
    expect(check.errors).toEqual([]);
    expect(check.warnings.some((w) => w.includes('dépasse le budget'))).toBe(true);
    const v = validateProgramme(s, params);
    expect(v.planning.validated.program).toBe('2025-11-03');
  });

  it('refuses to validate an empty programme or one without the mandatory diligences', () => {
    const s = fresh();
    expect(programmeCheck(s, params).errors[0]).toMatch(/vide/);
    expect(validateProgramme(s, params)).toBe(s);
    const s2 = planProcedure(s, params, 'payroll');
    expect(programmeCheck(s2, params).errors.length).toBe(params.procedures.procedures.filter((p) => p.mandatory || p.overrideResponse).length);
  });
});

describe('conditions (prerequisites of the procedures)', () => {
  it('evaluates vintages, dates, periods, documents, requests and procedures with reasons in French', () => {
    const s = fresh();
    const c0 = conditionContext(s, params);
    expect(evaluate({ kind: 'vintage', vintage: 'interim' }, c0)).toMatchObject({ ok: false });
    expect(evaluate({ kind: 'vintage', vintage: 'interim' }, c0).reasons[0]).toMatch(/extraction comptable au 31\/10\/2025/);
    const c1 = conditionContext(advanceTo(s, '2025-11-17'), params);
    expect(evaluate({ kind: 'vintage', vintage: 'interim' }, c1).ok).toBe(true);
    expect(evaluate({ kind: 'vintage', vintage: 'draftLedger' }, c1).ok).toBe(false);
    expect(evaluate({ kind: 'vintage', vintage: 'draftStatements' }, conditionContext(advanceTo(s, '2026-02-20'), params)).ok).toBe(true);
    expect(evaluate({ kind: 'dateFrom', date: '2026-01-01' }, c1).reasons).toEqual(['Possible à partir du 01/01/2026.']);
    expect(evaluate({ kind: 'period', ids: ['interim'] }, c1).ok).toBe(true);
    expect(evaluate({ kind: 'period', ids: ['final'] }, c1).ok).toBe(false);
    expect(evaluate({ kind: 'document', docId: 'x' }, c1).ok).toBe(false);
    expect(evaluate({ kind: 'document', docId: 'x' }, { ...c1, isDocumentAvailable: (id) => id === 'x' }).ok).toBe(true);
    expect(evaluate({ kind: 'request', family: 'interim-extraction' }, c1).ok).toBe(false);
    expect(evaluate({ kind: 'request', family: 'interim-extraction' }, { ...c1, answered: new Set(['interim-extraction']) }).ok).toBe(true);
    expect(evaluate({ kind: 'procedure', procedureId: 'board-minutes', state: 'delivered' }, { ...c1, procedureProgress: () => 'documented' }).ok).toBe(true);
    expect(evaluate({ kind: 'procedure', procedureId: 'board-minutes', state: 'delivered' }, c1).ok).toBe(false);
    expect(evaluate({ kind: 'any', of: [{ kind: 'dateFrom', date: '2030-01-01' }, { kind: 'period', ids: ['interim'] }] }, c1).ok).toBe(true);
    expect(evaluate({ kind: 'not', of: { kind: 'period', ids: ['interim'] } }, c1).ok).toBe(false);
    expect(evaluateAll([{ kind: 'dateFrom', date: '2030-01-01' }, { kind: 'vintage', vintage: 'draftLedger' }], c1).reasons).toHaveLength(2);
  });
});

describe('executions: launch, scheduling, delivery', () => {
  it('launches a planning procedure, schedules it on the senior’s working days and delivers its worksheet at the end date', () => {
    let s = launch(fresh(), 'board-minutes', 'senior');
    const e = s.program.executions[0]!;
    expect(e.hours).toBe(def('board-minutes').hours.senior);
    expect(s.program.planned).toEqual([{ procedureId: 'board-minutes', assignee: 'senior' }]);
    const t = scheduleExecutions(s.program, cal).get(e.id)!;
    expect(t.start).toBe('2025-11-03');
    expect(t.end).toBe(e.hours > 7 ? '2025-11-04' : '2025-11-03');
    expect(hoursCharged(s.program, params)).toEqual([{ member: 'senior', hours: e.hours, on: '2025-11-03' }]);
    expect(hoursUsed(s, params).team).toBe(e.hours);
    // the delivery is an upcoming event until its date
    const up = upcomingProgram(s.program, { params, cal, date: '2025-11-03' });
    if (t.end! > '2025-11-03') expect(up[0]).toMatchObject({ date: t.end, kind: 'delivery', to: '/travaux' });
    s = advanceTo(s, t.end!);
    expect(statusOf(s, s.program.executions[0]!)).toBe('delivered');
    expect(upcomingProgram(s.program, { params, cal, date: s.clock.date })).toEqual([]);
  });

  it('queues the work of a member: the next procedure starts when the previous one ends', () => {
    let s = launch(fresh(), 'permanent-file', 'senior');
    s = launch(s, 'board-minutes', 'senior');
    s = launch(s, 'fraud-assessment', 'senior');
    const sched = scheduleExecutions(s.program, cal);
    const [a, b, c] = s.program.executions.map((e) => sched.get(e.id)!);
    expect(a!.start! <= b!.start!).toBe(true);
    expect(b!.end! <= c!.end!).toBe(true);
    // 11/11 is a public holiday: never a working day of the schedule
    for (const t of [a, b, c]) expect([t!.start, t!.end]).not.toContain('2025-11-11');
  });

  it('refuses a launch outside the phases, for a profile that cannot run it, or before its data, with the reasons', () => {
    const s = fresh();
    const jet = canLaunch(s, params, 'journal-entry-tests', 'senior', ctx(s));
    expect(jet.ok).toBe(false);
    expect(jet.reasons.some((r) => r.startsWith('Procédure à mener pendant le final ou la synthèse'))).toBe(true);
    expect(jet.reasons.some((r) => r.includes('balance et le FEC définitifs'))).toBe(true);
    expect(canLaunch(s, params, 'impairment-recalc', 'hugo', ctx(s)).reasons[0]).toMatch(/ne peut pas être confiée/);
    // Léa is on site from the interim: an interim procedure launched during the planning waits for her
    const s2 = launch(s, 'rent-controls', 'lea');
    const t = scheduleExecutions(s2.program, cal).get(s2.program.executions[0]!.id)!;
    expect(t.start).toBe('2025-11-17');
    // the preliminary analytical review needs the extraction
    expect(canLaunch(s, params, 'preliminary-analytical', 'senior', ctx(s)).ok).toBe(false);
    const s3 = advanceTo(s, '2025-11-17');
    expect(canLaunch(s3, params, 'preliminary-analytical', 'senior', ctx(s3)).ok).toBe(true);
    // launched once only
    expect(canLaunch(s2, params, 'rent-controls', 'lea', ctx(s2)).reasons).toContain('La procédure a déjà été lancée.');
    // the subsequent events review: from 01/01/2026, and during the final or later
    const fin = advanceTo(s, '2026-02-23');
    expect(canLaunch(fin, params, 'subsequent-events', 'senior', ctx(fin)).ok).toBe(true);
    expect(canLaunch(s, params, 'subsequent-events', 'senior', ctx(s)).ok).toBe(false);
  });

  it('cancels a launch not yet started and gives its hours back', () => {
    let s = launch(fresh(), 'rent-controls', 'lea');
    const id = s.program.executions[0]!.id;
    s = cancelExecution(s, id, cal);
    expect(s.program.executions).toEqual([]);
    expect(hoursUsed(s, params).team).toBe(0);
    const started = launch(fresh(), 'board-minutes', 'senior');
    expect(cancelExecution(started, started.program.executions[0]!.id, cal)).toBe(started);
  });
});

describe('worksheets: documentation, completion, form check, review', () => {
  it('documents a worksheet once delivered; a memo procedure is complete once documented', () => {
    let s = launch(fresh(), 'engagement-acceptance', 'senior');
    const id = s.program.executions[0]!.id;
    s = advanceTo(s, '2025-11-04');
    expect(documentExecution(s, params, id, 'unknown', '', cal)).toBe(s);
    s = documentExecution(s, params, id, 'satisfactory', '  Indépendance confirmée  ', cal);
    const e = s.program.executions[0]!;
    expect(e).toMatchObject({ conclusion: 'satisfactory', comment: 'Indépendance confirmée', documentedOn: '2025-11-04' });
    const st = statusOf(s, e);
    expect(st).toBe('documented');
    const c = completionOf(e, def('engagement-acceptance'), st, { params, date: s.clock.date, state: s, answered: new Set() });
    expect(c.done).toBe(true);
    expect(formCheck(e, st, [])).toEqual(['Feuille sans référence : liez les pièces, requêtes ou travaux qui fondent la conclusion.']);
    s = addExecutionRef(s, id, { kind: 'doc', id: 'declarations-independance' });
    expect(addExecutionRef(s, id, { kind: 'doc', id: 'declarations-independance' })).toBe(s);
    expect(formCheck(s.program.executions[0]!, st, s.program.executions[0]!.refs)).toEqual([]);
    s = removeExecutionRef(s, id, { kind: 'doc', id: 'declarations-independance' });
    expect(s.program.executions[0]!.refs).toEqual([]);
  });

  it('refuses to document before the delivery', () => {
    const s = launch(fresh(), 'rent-controls', 'lea');
    expect(documentExecution(s, params, s.program.executions[0]!.id, 'satisfactory', '', cal)).toBe(s);
  });

  it('makes the journal-entry tests true: saved queries covering the usual criteria', () => {
    let s = advanceTo(fresh(), '2026-02-23');
    s = launch(s, 'journal-entry-tests', 'senior');
    const e = () => s.program.executions[0]!;
    const comp = () => completionOf(e(), def('journal-entry-tests'), statusOf(s, e()), { params, date: s.clock.date, state: s, answered: new Set() });
    expect(comp().items.find((i) => i.label.startsWith('Requêtes'))!.ok).toBe(false);
    s = saveQuery(s, 'Après clôture', { ...EMPTY_QUERY, validatedAfterClosing: true });
    s = saveQuery(s, 'Montants ronds le week-end', { ...EMPTY_QUERY, roundMultiple: 100_000, weekend: 'either' });
    s = saveQuery(s, 'Couples rares de la DAF', { ...EMPTY_QUERY, rarePairsMax: 2, users: ['X'] });
    expect(comp().items.find((i) => i.label.startsWith('Requêtes'))!.ok).toBe(true);
    // the queries saved after the launch are attached to the worksheet
    expect(derivedRefs(e(), def('journal-entry-tests'), s).filter((r) => r.kind === 'query')).toHaveLength(3);
    s = advanceTo(s, '2026-03-02');
    s = documentExecution(s, params, e().id, 'exceptions', 'Écritures inhabituelles relevées', cal);
    expect(comp().done).toBe(true);
  });

  it('makes the comparative check true: share of the N-1 cells ticked', () => {
    let s = advanceTo(fresh(), '2026-02-23');
    s = launch(s, 'comparative-check', 'hugo');
    const cells = STATEMENT_ORDER.flatMap((x) => statementCells(params.statements, x)).filter((k) => k.endsWith(':n-1'));
    const item = () => completionOf(s.program.executions[0]!, def('comparative-check'), 'delivered', { params, date: s.clock.date, state: s, answered: new Set() }).items[1]!;
    expect(item().ok).toBe(false);
    for (const c of cells.slice(0, Math.ceil(cells.length * 0.8))) s = setTick(s, c, 'certified');
    expect(item().ok).toBe(true);
  });

  it('requires an update of the subsequent events review after the final', () => {
    let s = advanceTo(fresh(), '2026-02-23');
    s = launch(s, 'subsequent-events', 'senior');
    const id = s.program.executions[0]!.id;
    s = advanceTo(s, '2026-03-02');
    s = documentExecution(s, params, id, 'satisfactory', '', cal);
    const done = () => completionOf(s.program.executions[0]!, def('subsequent-events'), 'documented', { params, date: s.clock.date, state: s, answered: new Set() }).done;
    expect(done()).toBe(false);
    s = advanceTo(s, '2026-05-15');
    s = updateExecution(s, id);
    expect(s.program.executions[0]!.updatedOn).toBe('2026-05-15');
    expect(done()).toBe(true);
  });

  it('records the review of a delegated worksheet (fields of J5), not of the senior’s own work', () => {
    let s = launch(fresh(), 'rent-controls', 'lea');
    s = launch(s, 'board-minutes', 'senior');
    const [lea, senior] = s.program.executions;
    expect(reviewExecution(s, senior!.id, 'accepted', '')).toBe(s);
    s = reviewExecution(s, lea!.id, 'returned', 'Étendre le test');
    expect(s.program.executions[0]!.review).toEqual({ status: 'returned', on: '2025-11-03', comment: 'Étendre le test' });
  });

  it('prepares a correct delegated worksheet: the available documents carrying clues of the parts the procedure can reveal', () => {
    const doc = (id: string, target: string, parts?: string[]): DocumentModel => ({
      id,
      title: `Pièce ${id}`,
      category: 'accounting',
      date: '2025-01-01',
      issuer: 'x',
      availability: { kind: 'initial' },
      blocks: [{ kind: 'paragraph', text: 'a' }, { kind: 'paragraph', text: 'b', clue: `${id}-c` }],
      clues: [{ id: `${id}-c`, target: target as 'A06', ...(parts ? { parts } : {}), documentId: id, source: 'accounting', text: 'x' }],
    });
    const docs = [doc('d1', 'A06'), doc('d2', 'A17'), doc('d3', 'A06')];
    const e: Execution = { id: 'e1', procedureId: 'additions-test', assignee: 'hugo', hours: 1, launchedOn: '2026-02-23', conclusion: null, comment: '', refs: [], review: { status: 'pending' } };
    const w = delegatedWorksheet(e, def('additions-test'), 'delivered', docs, (d) => d.id !== 'd3')!;
    expect(w.preparer).toBe('hugo');
    expect(w.points).toEqual([{ docId: 'd1', title: 'Pièce d1', blocks: [1] }]);
    expect(w.proposed).toBe('exceptions');
    expect(delegatedWorksheet({ ...e, assignee: 'senior' }, def('additions-test'), 'delivered', docs, () => true)).toBeNull();
    expect(delegatedWorksheet(e, def('additions-test'), 'inProgress', docs, () => true)).toBeNull();
    expect(delegatedWorksheet(e, def('payroll'), 'delivered', docs, () => true)!.proposed).toBe('satisfactory');
  });
});

describe('budget overrun: arbitration of the partner (J4-4)', () => {
  function overBudget(s: GameState): GameState {
    const big: Execution = { id: 'big', procedureId: 'payroll', assignee: 'hugo', hours: 370, launchedOn: '2025-11-03', conclusion: null, comment: '', refs: [], review: { status: 'pending' } };
    return { ...s, program: { ...s.program, executions: [big] } };
  }

  it('records an unjustified overrun beyond the tolerance (gauge event)', () => {
    const s = launch(overBudget(fresh()), 'board-minutes', 'senior');
    expect(s.gauges.arbitrations).toHaveLength(1);
    expect(s.gauges.arbitrations[0]!.justified).toBe(false);
    expect(s.gauges.arbitrations[0]!.overrunHours).toBeCloseTo(370 + def('board-minutes').hours.senior! - 340, 5);
    expect(s.gauges.events.map((e) => e.reason)).toEqual([UNJUSTIFIED_OVERRUN]);
  });

  it('justifies the overrun on a cycle assessed high before the execution', () => {
    const s0 = setRisk(overBudget(fresh()), 'crossCycle', null, 'high', 'Gouvernance');
    const s = launch(s0, 'board-minutes', 'senior');
    expect(s.gauges.arbitrations[0]!.justified).toBe(true);
    expect(s.gauges.events).toEqual([]);
  });

  it('does not arbitrate within the tolerance', () => {
    const s = launch(fresh(), 'board-minutes', 'senior');
    expect(s.gauges.arbitrations).toEqual([]);
  });
});

describe('Antoine’s advice (plan J4 §14)', () => {
  it('points to a cycle assessed at risk whose detailed procedures were not launched, worded as method', () => {
    let s = setRisk(fresh(), 'fixedAssets', null, 'high', 'Livraisons et remplacements');
    const a = antoineAdvice(s, params, s.clock.date);
    expect(a.cycle).toBe('fixedAssets');
    expect(a.procedures.length).toBeGreaterThan(0);
    for (const id of a.procedures) expect(def(id).cycle).toBe('fixedAssets');
    expect(a.text).not.toMatch(/\bA\d\d\b|anomalie|erreur/i);
    // a planned procedure is suggested first
    s = planProcedure(s, params, 'sales-cutoff');
    expect(antoineAdvice(s, params, s.clock.date).procedures[0]).toBe('sales-cutoff');
  });

  it('is free at the assistant level, costs the partner’s trust at the senior level, unavailable at the manager level', () => {
    expect(aidMode(params, 'assistant')).toBe('free');
    const a = askAntoine(fresh('assistant'), params);
    expect(a.gauges.events).toEqual([]);
    expect(a.journal.at(-1)!.kind).toBe('aid');
    const s = askAntoine(fresh('senior'), params);
    expect(s.gauges.events.map((e) => e.reason)).toEqual([AID_USED]);
    const m = fresh('manager');
    expect(askAntoine(m, params)).toBe(m);
  });
});

describe('persistence of the programme section', () => {
  it('saves and reloads the programme and the worksheets', () => {
    let s = adoptFirmProgramme(fresh(), params);
    s = launch(s, 'engagement-acceptance', 'senior');
    s = advanceTo(s, '2025-11-04');
    s = documentExecution(s, params, s.program.executions[0]!.id, 'satisfactory', 'ok', cal);
    s = addExecutionRef(s, s.program.executions[0]!.id, { kind: 'doc', id: 'kbis', block: 2 });
    const r = deserialize(serialize(s), fresh());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.program).toEqual(s.program);
  });
});
