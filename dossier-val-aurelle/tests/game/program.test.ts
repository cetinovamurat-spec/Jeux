/** Work programme, executions, completion, conditions and Antoine's advice (plan J4 §6.3, §7, §14, §16). Pure rules. */
import { describe, expect, it } from 'vitest';
import { advanceTo } from '../../src/game/advance';
import { AID_USED, aidMode, antoineAdvice, askAntoine } from '../../src/game/aid';
import { hoursUsed } from '../../src/game/budget';
import { workCalendar } from '../../src/game/calendar';
import { conditionContext, evaluate, evaluateAll } from '../../src/game/conditions';
import { EMPTY_QUERY } from '../../src/game/fec-query';
import { prepareConfirmation } from '../../src/game/confirmations';
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
  launchBudgetImpact,
  launchExecution,
  memberName,
  plannedHours,
  previewLaunch,
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
  type CompletionContext,
  type Execution,
  type LaunchContext,
} from '../../src/game/program';
import { initialState, markRead, saveQuery, setTick, type GameState } from '../../src/game/state';
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

  it('checks the phase on the day the work would start after the member’s queue, not on the member’s next day on site', () => {
    // the senior's interim (17-20/11, 4 days at 7 h) is full: an interim procedure would start in the final
    const busy: Execution = { id: 'busy', procedureId: 'payroll', assignee: 'senior', hours: 28, launchedOn: '2025-11-17', conclusion: null, comment: '', refs: [], review: { status: 'pending' } };
    const s = advanceTo(fresh(), '2025-11-17');
    const full = { ...s, program: { ...s.program, executions: [busy] } };
    expect(canLaunch(s, params, 'permanent-file', 'senior', ctx(s)).ok).toBe(true);
    const check = canLaunch(full, params, 'permanent-file', 'senior', ctx(full));
    expect(check.ok).toBe(false);
    expect(check.reasons).toContain('Procédure à mener pendant la planification ou l’intérim ; vos travaux ne commenceraient que le 23/02/2026.');
    expect(launch(full, 'permanent-file', 'senior')).toBe(full);
    // Léa's queue is empty: she can still run it during the interim
    expect(canLaunch(full, params, 'permanent-file', 'lea', ctx(full)).ok).toBe(true);
  });

  it('refuses a launch that cannot be finished before the member leaves the site; an unfinishable launch can be cancelled and relaunched', () => {
    const s = advanceTo(fresh(), '2026-03-12');
    const lea = canLaunch(s, params, 'journal-entry-tests', 'lea', ctx(s));
    expect(lea.reasons).toEqual([`La procédure ne pourrait pas être terminée avant la fin de la présence sur site de ${memberName(params, 'lea')}.`]);
    expect(canLaunch(s, params, 'journal-entry-tests', 'senior', ctx(s)).ok).toBe(true);
    // a launch saved before this check: started, never finished
    const stuck: Execution = { id: 'stuck', procedureId: 'journal-entry-tests', assignee: 'lea', hours: def('journal-entry-tests').hours.assistant!, launchedOn: '2026-03-12', conclusion: null, comment: '', refs: [], review: { status: 'pending' } };
    let late = advanceTo({ ...s, program: { ...s.program, executions: [stuck] } }, '2026-03-16');
    expect(statusOf(late, stuck)).toBe('unfinishable');
    late = cancelExecution(late, 'stuck', cal, params);
    expect(late.program.executions).toEqual([]);
    expect(canLaunch(late, params, 'journal-entry-tests', 'senior', ctx(late)).ok).toBe(true);
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
  it('documents a worksheet once delivered; a memo procedure is complete once documented with the evidence it cites', () => {
    let s = launch(fresh(), 'engagement-acceptance', 'senior');
    const id = s.program.executions[0]!.id;
    s = advanceTo(s, '2025-11-04');
    expect(documentExecution(s, params, id, 'unknown', '', cal)).toBe(s);
    s = documentExecution(s, params, id, 'satisfactory', '  Indépendance confirmée  ', cal);
    const e = s.program.executions[0]!;
    expect(e).toMatchObject({ conclusion: 'satisfactory', comment: 'Indépendance confirmée', documentedOn: '2025-11-04' });
    const st = statusOf(s, e);
    expect(st).toBe('documented');
    const done = () => completionOf(s.program.executions[0]!, def('engagement-acceptance'), st, { params, date: s.clock.date, state: s, answered: new Set() }).done;
    expect(done()).toBe(false);
    expect(formCheck(e, st, [])).toEqual(['Feuille sans référence : liez les pièces, requêtes ou travaux qui fondent la conclusion.']);
    s = addExecutionRef(s, id, { kind: 'doc', id: 'declarations-independance' });
    expect(addExecutionRef(s, id, { kind: 'doc', id: 'declarations-independance' })).toBe(s);
    expect(formCheck(s.program.executions[0]!, st, s.program.executions[0]!.refs)).toEqual([]);
    expect(done()).toBe(true);
    s = removeExecutionRef(s, id, { kind: 'doc', id: 'declarations-independance' });
    expect(s.program.executions[0]!.refs).toEqual([]);
    expect(done()).toBe(false);
  });

  it('never completes a procedure on a conclusion alone: the prorata recalculation of the accruals, a reference for the override responses', () => {
    let s = advanceTo(fresh(), '2026-02-23');
    s = launch(s, 'accruals-review', 'senior');
    s = launch(s, 'unusual-transactions', 'senior');
    const [accruals, unusual] = s.program.executions;
    s = advanceTo(s, '2026-02-25');
    s = documentExecution(s, params, accruals!.id, 'satisfactory', '', cal);
    s = documentExecution(s, params, unusual!.id, 'satisfactory', '', cal);
    const comp = (i: number) => {
      const e = s.program.executions[i]!;
      return completionOf(e, def(e.procedureId), statusOf(s, e), { params, date: s.clock.date, state: s, answered: new Set() });
    };
    expect(statusOf(s, s.program.executions[0]!)).toBe('documented');
    expect(comp(0).done).toBe(false);
    expect(comp(0).items.find((i) => i.label === 'Recalcul effectué dans la procédure')!.ok).toBe(false);
    expect(comp(1).done).toBe(false);
    s = { ...s, recalcs: { items: [{ id: 'rc1', executionId: accruals!.id, tool: 'prorata', scope: 'free', assumptions: {}, summary: { computed: 0, recorded: 0 }, on: s.clock.date }] } };
    expect(comp(0).done).toBe(true);
    s = addExecutionRef(s, unusual!.id, { kind: 'doc', id: 'detail-comptes-attente' });
    expect(comp(1).done).toBe(true);
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

  it('counts only the confirmations of the procedure’s third parties', () => {
    let s = launch(fresh(), 'litigation', 'senior');
    const e = s.program.executions[0]!;
    const populationOf = (id: string) => (id === 'BDT' ? ('lenders' as const) : id === 'F0033' ? ('lawyers' as const) : undefined);
    const comp = () => completionOf(e, def('litigation'), 'delivered', { params, date: s.clock.date, state: s, answered: new Set(), populationOf }).items[1]!;
    s = prepareConfirmation(s, 'BDT', 'Banque des Territoires', 'senior', params);
    expect(comp()).toMatchObject({ ok: false, label: expect.stringContaining(': 0 ') });
    expect(derivedRefs(e, def('litigation'), s, params, populationOf)).toEqual([]);
    s = prepareConfirmation(s, 'F0033', 'Avocat', 'senior', params);
    expect(comp().ok).toBe(true);
    expect(derivedRefs(e, def('litigation'), s, params, populationOf)).toEqual([{ kind: 'confirmation', id: 'F0033' }]);
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

  describe('delegated worksheet (§7): correct, limited to what the work of the procedure reached', () => {
    const clue = (id: string, target: string, parts?: string[]) => ({ id, target: target as 'A04', ...(parts ? { parts } : {}), documentId: id, source: 'accounting' as const, text: 'x' });
    const doc = (id: string, category: DocumentModel['category'], target: string | null, availability: DocumentModel['availability'] = { kind: 'initial' }): DocumentModel => ({
      id,
      title: `Pièce ${id}`,
      category,
      date: '2025-01-01',
      issuer: 'x',
      availability,
      blocks: [{ kind: 'paragraph', text: 'a' }, { kind: 'paragraph', text: 'b', ...(target ? { clue: `${id}-c` } : {}) }],
      clues: target ? [clue(`${id}-c`, target)] : [],
    });
    const exec = (procedureId: string, assignee: Execution['assignee'] = 'lea', refs: Execution['refs'] = []): Execution => ({ id: 'e1', procedureId, assignee, hours: 1, launchedOn: '2025-11-17', conclusion: null, comment: '', refs, review: { status: 'pending' } });
    const cctx = (s: GameState, extra: Partial<CompletionContext> = {}): CompletionContext => ({ params, date: s.clock.date, state: s, answered: new Set(), ...extra });

    it('reports nothing and proposes no conclusion before the work criteria are met; never for the senior’s own work or before the delivery', () => {
      // the board minutes: the governance documents read (80 %) — a permanent memo and an internal note with clues are outside its reach
      const docs = [doc('pv', 'governance', 'A17'), doc('pv2', 'governance', null), doc('memo', 'permanent', 'A17'), doc('note', 'internal', 'A17'), doc('pv3', 'governance', 'A04')];
      const available = docs.map((d) => ({ id: d.id, category: d.category }));
      let s = fresh();
      const e = exec('board-minutes');
      expect(delegatedWorksheet(e, def('board-minutes'), 'delivered', cctx(s, { availableDocs: available }), docs)).toEqual({ preparer: 'lea', pending: 'work', points: [], work: [], proposed: null });
      for (const id of ['pv', 'pv2', 'pv3']) s = markRead(s, id);
      const w = delegatedWorksheet(e, def('board-minutes'), 'delivered', cctx(s, { availableDocs: available }), docs)!;
      expect(w.pending).toBeNull();
      expect(w.points.map((p) => p.docId)).toEqual(['pv', 'pv3']);
      expect(w.points[0]!.blocks).toEqual([1]);
      expect(w.proposed).toBe('exceptions');
      expect(delegatedWorksheet({ ...e, assignee: 'senior' }, def('board-minutes'), 'delivered', cctx(s, { availableDocs: available }), docs)).toBeNull();
      expect(delegatedWorksheet(e, def('board-minutes'), 'inProgress', cctx(s, { availableDocs: available }), docs)).toBeNull();
    });

    it('reaches the replies to its own requests and confirmations only, and waits for the replies before concluding', () => {
      const reply = doc('releve', 'thirdParty', 'A18', { kind: 'onRequest', request: 'x', from: 'cfo', family: 'bank-statements', object: '2025-12' });
      const other = doc('etat-dette', 'accounting', 'A18');
      const s = fresh();
      const bank = exec('bank-reconciliation', 'hugo');
      expect(delegatedWorksheet(bank, def('bank-reconciliation'), 'delivered', cctx(s), [reply, other])!.pending).toBe('work');
      const got = delegatedWorksheet(bank, def('bank-reconciliation'), 'delivered', cctx(s, { received: new Set(['bank-statements:2025-12']) }), [reply, other])!;
      expect(got.points.map((p) => p.docId)).toEqual(['releve']);
      expect(got.proposed).toBe('exceptions');
      // the lenders' confirmations: the reply of a third party confirmed in the procedure, once it has arrived
      const lenders = exec('lender-confirmations');
      const conf = doc('confirmation-bdt', 'thirdParty', 'A18', { kind: 'confirmation', request: 'BDT', arrives: '2026-02-02' });
      const prepared = prepareConfirmation(s, 'BDT', 'Banque des Territoires', 'lea', params, lenders.id);
      expect(delegatedWorksheet(lenders, def('lender-confirmations'), 'delivered', cctx(s), [conf, other])!.pending).toBe('work');
      const sent = delegatedWorksheet(lenders, def('lender-confirmations'), 'delivered', cctx(prepared, { confirmationState: () => 'sent' }), [other])!;
      expect(sent).toMatchObject({ pending: 'replies', points: [], proposed: null });
      const replied = delegatedWorksheet(lenders, def('lender-confirmations'), 'delivered', cctx(prepared, { confirmationState: () => 'replied' }), [conf, other])!;
      expect(replied).toMatchObject({ pending: null, points: [{ docId: 'confirmation-bdt' }], proposed: 'exceptions' });
    });

    it('reports the results of its own samples and recalculations, never the clues of documents its work did not reach', () => {
      const pv = doc('pv-ca', 'governance', 'A04');
      let s = advanceTo(fresh(), '2026-02-23');
      const e = exec('depreciation-recalc');
      s = { ...s, recalcs: { items: [{ id: 'rc1', executionId: e.id, tool: 'depreciation', scope: 'GLB', assumptions: {}, summary: { computed: 100, recorded: 100 }, on: s.clock.date }] } };
      expect(delegatedWorksheet(e, def('depreciation-recalc'), 'delivered', cctx(s), [pv])).toMatchObject({ pending: null, points: [], work: [], proposed: 'satisfactory' });
      s = { ...s, recalcs: { items: [{ ...s.recalcs.items[0]!, summary: { computed: 150, recorded: 100 } }] } };
      expect(delegatedWorksheet(e, def('depreciation-recalc'), 'delivered', cctx(s), [pv])).toMatchObject({ points: [], work: [{ kind: 'recalc', id: 'rc1' }], proposed: 'exceptions' });
      // a procedure without effective parts, documented with a reference: nothing to report
      const payroll = { ...exec('payroll', 'hugo', [{ kind: 'doc', id: 'pv-ca' }]), id: 'e2' };
      expect(delegatedWorksheet(payroll, def('payroll'), 'delivered', cctx(s), [pv])).toMatchObject({ pending: null, points: [], proposed: 'satisfactory' });
    });
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

  it('withdraws the arbitration and its gauge event when the launch is cancelled, and arbitrates the relaunch once', () => {
    // Léa is on site from the interim: launched during the planning, the work has not started
    let s = launch(overBudget(fresh()), 'rent-controls', 'lea');
    const id = s.program.executions.at(-1)!.id;
    expect(s.gauges.arbitrations).toMatchObject([{ justified: false, executionId: id }]);
    expect(s.gauges.events).toMatchObject([{ reason: UNJUSTIFIED_OVERRUN, executionId: id }]);
    s = cancelExecution(s, id, cal, params);
    expect(s.gauges).toEqual({ events: [], arbitrations: [] });
    s = launch(s, 'rent-controls', 'lea');
    expect(s.gauges.arbitrations).toHaveLength(1);
    expect(s.gauges.events).toHaveLength(1);
    // another gauge event is kept
    const other = { ...s, gauges: { ...s.gauges, events: [...s.gauges.events, { on: '2025-11-03', gauge: 'clientRelation' as const, reason: 'duplicateRequest' }] } };
    expect(cancelExecution(other, other.program.executions.at(-1)!.id, cal, params).gauges.events.map((e) => e.reason)).toEqual(['duplicateRequest']);
  });

  it('does not arbitrate within the tolerance', () => {
    const s = launch(fresh(), 'board-minutes', 'senior');
    expect(s.gauges.arbitrations).toEqual([]);
  });

  it('tells before the launch whether the partner will arbitrate (the IT auditor has a separate envelope)', () => {
    const within = launchBudgetImpact(fresh(), params, 'board-minutes', 'senior')!;
    expect(within).toMatchObject({ before: 0, after: def('board-minutes').hours.senior, budget: 340, arbitration: false, justified: false });
    expect(within.limit).toBeCloseTo(374, 5);
    const over = launchBudgetImpact(overBudget(fresh()), params, 'board-minutes', 'senior')!;
    expect(over).toMatchObject({ before: 370, arbitration: true, justified: false });
    expect(launchBudgetImpact(setRisk(overBudget(fresh()), 'crossCycle', null, 'high', 'Gouvernance'), params, 'board-minutes', 'senior')!.justified).toBe(true);
    expect(launchBudgetImpact(fresh(), params, 'migration-review', 'sofia')).toBeNull();
    expect(launchBudgetImpact(fresh(), params, 'impairment-recalc', 'hugo')).toBeNull();
  });
});

describe('launch preview', () => {
  it('gives the dates a launch would get, after the member’s queue, without changing the state', () => {
    const s0 = fresh();
    expect(previewLaunch(s0.program, cal, 'senior', 4.5, s0.clock.date)).toMatchObject({ start: '2025-11-03', end: '2025-11-03' });
    const s = launch(s0, 'board-minutes', 'senior');
    const t = scheduleExecutions(s.program, cal).get(s.program.executions[0]!.id)!;
    const p = previewLaunch(s.program, cal, 'senior', 7, s.clock.date);
    expect(p.start! >= t.end!).toBe(true);
    expect(s.program.executions).toHaveLength(1);
    // Léa is on site from the interim only
    expect(previewLaunch(s0.program, cal, 'lea', 7, s0.clock.date).start).toBe('2025-11-17');
  });
});

describe('journal of the programme (desk: kinds and French subjects)', () => {
  it('logs the programme, launches and worksheets with a French title, never a bare identifier', () => {
    let s = planProcedure(fresh(), params, 'board-minutes', 'lea');
    expect(s.journal.at(-1)).toMatchObject({ kind: 'program', ref: 'board-minutes', data: { action: 'plan', title: expect.stringContaining('Léa') } });
    s = launch(s, 'engagement-acceptance', 'senior');
    expect(s.journal.at(-1)).toMatchObject({ kind: 'execution', data: { action: 'launch', title: expect.stringContaining(def('engagement-acceptance').title) } });
    const id = s.program.executions[0]!.id;
    s = documentExecution(s, params, id, 'satisfactory', '', cal);
    expect(s.journal.at(-1)).toMatchObject({ kind: 'worksheet', data: { action: 'document', conclusion: 'satisfactory' } });
    expect(String(s.journal.at(-1)!.data!['title'])).toMatch(/documentée/);
    // Léa is on site from the interim: her work has not started, the launch can be cancelled
    s = launch(s, 'board-minutes', 'lea');
    s = cancelExecution(s, s.program.executions.at(-1)!.id, cal, params);
    expect(s.journal.at(-1)).toMatchObject({ kind: 'execution', data: { action: 'cancel' } });
    for (const e of s.journal) if (['program', 'execution', 'worksheet'].includes(e.kind)) expect(typeof e.data?.['title']).toBe('string');
  });
});

describe('Antoine’s advice (plan J4 §14)', () => {
  it('points to a cycle the player assessed at risk whose effective procedures were not launched, worded as method', () => {
    const none = antoineAdvice(fresh(), params, '2025-11-03');
    expect(none.cycle).toBeNull();
    expect(none.text).toMatch(/évaluer les risques/);
    const s = setRisk(fresh(), 'fixedAssets', null, 'high', 'Livraisons et remplacements');
    const a = antoineAdvice(s, params, s.clock.date);
    expect(a.cycle).toBe('fixedAssets');
    expect(a.text).not.toMatch(/\bA\d\d\b|anomalie|erreur/i);
    // never a procedure by its title
    for (const p of params.procedures.procedures) expect(a.text.includes(p.title), p.id).toBe(false);
    // once its effective procedures are launched, the cycle is no longer pointed to
    const executions = params.procedures.procedures
      .filter((p) => p.cycle === 'fixedAssets' && p.effectiveFor.length > 0)
      .map((p, i): Execution => ({ id: `x${i}`, procedureId: p.id, assignee: 'senior', hours: 1, launchedOn: '2025-11-03', conclusion: null, comment: '', refs: [], review: { status: 'pending' } }));
    expect(antoineAdvice({ ...s, program: { ...s.program, executions } }, params, s.clock.date).cycle).toBeNull();
  });

  it('gives the same answer whatever procedure is planned or removed from the programme', () => {
    let s = setRisk(fresh('assistant'), 'fixedAssets', null, 'significant', 'Livraisons et remplacements');
    s = setRisk(s, 'rentReceivables', 'valuation', 'high', 'Impayés');
    s = adoptFirmProgramme(s, params);
    const before = antoineAdvice(s, params, s.clock.date);
    for (const p of params.procedures.procedures) {
      const planned = s.program.planned.some((x) => x.procedureId === p.id);
      const changed = planned ? unplanProcedure(s, params, p.id) : planProcedure(s, params, p.id);
      expect(antoineAdvice(changed, params, s.clock.date), p.id).toEqual(before);
    }
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
