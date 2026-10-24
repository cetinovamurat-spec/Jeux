/** Game state actions, persistence and calendar (pure). */
import { describe, expect, it } from 'vitest';
import { hoursUsed } from '../../src/game/budget';
import { periodAt } from '../../src/game/clock';
import { EMPTY_QUERY } from '../../src/game/fec-query';
import { cleanOrphans, deserialize, serialize } from '../../src/game/persistence';
import {
  addAnnotation,
  addTickMark,
  deleteQuery,
  initialState,
  markRead,
  removeAnnotation,
  removeTickMark,
  saveQuery,
  setDesigner,
  setTheme,
  setTick,
  toggleEvidence,
  updateTickMark,
  SCHEMA_VERSION,
  type GameState,
} from '../../src/game/state';
import { loadParams } from '../../src/scenario/params';

const fresh = () => initialState(loadParams());

describe('game state', () => {
  it('starts at the configured date with the default marks and no activity', () => {
    const s = fresh();
    expect(s.schemaVersion).toBe(SCHEMA_VERSION);
    expect(s.clock.date).toBe(loadParams().game.startDate);
    expect(s.tickMarks.length).toBeGreaterThanOrEqual(4);
    expect(s.journal).toEqual([]);
  });
  it('marks a document read once and logs it', () => {
    const s1 = markRead(fresh(), 'doc-a');
    expect(s1.documents['doc-a']!.readOn).toBe(s1.clock.date);
    expect(markRead(s1, 'doc-a')).toBe(s1);
    expect(s1.journal.map((e) => e.kind)).toEqual(['documentRead']);
  });
  it('adds and removes annotations, ignores empty text, toggles evidence', () => {
    let s = addAnnotation(fresh(), 'doc-a', '  à vérifier  ', 2);
    expect(addAnnotation(s, 'doc-a', '   ')).toBe(s);
    const a = s.documents['doc-a']!.annotations[0]!;
    expect(a).toMatchObject({ text: 'à vérifier', block: 2 });
    s = removeAnnotation(s, 'doc-a', a.id);
    expect(s.documents['doc-a']!.annotations).toEqual([]);
    s = toggleEvidence(s, 'doc-a');
    expect(s.documents['doc-a']!.evidence).toBe(true);
    expect(toggleEvidence(s, 'doc-a').documents['doc-a']!.evidence).toBe(false);
  });
  it('ticks cells with existing marks only; removing a mark removes its ticks', () => {
    let s = setTick(fresh(), 'etats:A_TERRAINS:n', 'balance');
    expect(s.ticks['etats:A_TERRAINS:n']).toBe('balance');
    expect(setTick(s, 'x', 'unknown-mark')).toBe(s);
    s = addTickMark(s, { symbol: 'R', label: 'Recalculé', tone: 'accent' });
    const id = s.tickMarks[s.tickMarks.length - 1]!.id;
    s = setTick(s, 'etats:P_CP:n', id);
    s = updateTickMark(s, id, { label: 'Recalculé par moi' });
    expect(s.tickMarks.find((m) => m.id === id)!.label).toBe('Recalculé par moi');
    s = removeTickMark(s, id);
    expect(s.ticks['etats:P_CP:n']).toBeUndefined();
    expect(s.ticks['etats:A_TERRAINS:n']).toBe('balance');
    s = setTick(s, 'etats:A_TERRAINS:n', null);
    expect(s.ticks).toEqual({});
  });
  it('saves and deletes FEC queries with unique ids', () => {
    let s = saveQuery(fresh(), 'Après clôture', { ...EMPTY_QUERY, validatedAfterClosing: true });
    s = saveQuery(s, 'Week-end', { ...EMPTY_QUERY, weekend: 'either' });
    expect(new Set(s.savedQueries.map((q) => q.id)).size).toBe(2);
    expect(saveQuery(s, '  ', EMPTY_QUERY)).toBe(s);
    s = deleteQuery(s, s.savedQueries[0]!.id);
    expect(s.savedQueries.map((q) => q.name)).toEqual(['Week-end']);
  });
  it('round-trips through the save format and rejects foreign or corrupt saves', () => {
    let s = fresh();
    s = setTheme(setDesigner(markRead(s, 'doc-a'), true), 'dark');
    s = saveQuery(addAnnotation(s, 'doc-a', 'note'), 'Q', { ...EMPTY_QUERY, keywords: 'régul' });
    const r = deserialize(serialize(s), fresh());
    expect(r.ok && r.state).toEqual(s);
    expect(r.ok && (r.migratedFrom ?? r.contentChanged)).toBeFalsy();
    expect(deserialize('{', fresh()).ok).toBe(false);
    expect(deserialize(serialize({ ...s, scenarioId: 'autre-dossier' }), fresh()).ok).toBe(false);
    expect(deserialize(JSON.stringify({ ...s, schemaVersion: 99 }), fresh()).ok).toBe(false);
  });
  it('flags a save made with another generated world or another content version, once: the save adopts the current content', () => {
    const r = deserialize(serialize({ ...fresh(), scenarioHash: 'autre', contentVersion: 0 }), fresh());
    expect(r.ok && r.contentChanged).toBe(true);
    if (!r.ok) return;
    expect(r.state).toMatchObject({ scenarioHash: fresh().scenarioHash, contentVersion: fresh().contentVersion });
    const again = deserialize(serialize(r.state), fresh());
    expect(again.ok && again.contentChanged).toBeFalsy();
  });

  it('cleans the references the current content no longer knows, and lists them', () => {
    const params = loadParams();
    const known = (id: string) => id !== 'piece-retiree';
    let s = markRead(markRead(fresh(), 'kbis'), 'piece-retiree');
    s = {
      ...s,
      program: {
        planned: [
          { procedureId: 'board-minutes', assignee: 'senior' },
          { procedureId: 'procedure-retiree', assignee: 'senior' },
        ],
        briefings: [],
        executions: [
          { id: 'x1', procedureId: 'board-minutes', assignee: 'senior', hours: 7.5, launchedOn: '2025-11-03', conclusion: null, comment: '', refs: [{ kind: 'doc', id: 'kbis' }, { kind: 'doc', id: 'piece-retiree', block: 1 }, { kind: 'query', id: 'q1' }], seq: 1, reviewRounds: [] },
          { id: 'x2', procedureId: 'procedure-retiree', assignee: 'senior', hours: 4, launchedOn: '2025-11-03', conclusion: null, comment: '', refs: [], seq: 1, reviewRounds: [] },
        ],
      },
      requests: { items: [{ id: 'r1', family: 'interim-extraction', object: '', sentOn: '2025-11-03' }, { id: 'r2', family: 'famille-retiree', object: '', sentOn: '2025-11-03' }] },
      worksheets: { ...s.worksheets, master: { crossCycle: { explained: { l1: { text: 'x', evidence: ['kbis', 'piece-retiree'] } }, pins: ['doc:piece-retiree', 'finding:c1'], conclusion: null, comment: '' } } },
      planning: { ...s.planning, riskFactors: [{ id: 'f1', docId: 'piece-retiree', block: null, cycle: 'crossCycle', assertion: null, note: '', on: '2025-11-03' }] },
    };
    const r = cleanOrphans(s, params, known);
    expect(r.removed).toHaveLength(7);
    expect(r.state.program.planned.map((p) => p.procedureId)).toEqual(['board-minutes']);
    expect(r.state.program.executions.map((e) => e.id)).toEqual(['x1']);
    expect(r.state.program.executions[0]!.refs).toEqual([{ kind: 'doc', id: 'kbis' }, { kind: 'query', id: 'q1' }]);
    expect(r.state.requests.items.map((x) => x.id)).toEqual(['r1']);
    expect(Object.keys(r.state.documents)).toEqual(['kbis']);
    expect(r.state.worksheets.master['crossCycle']!.explained['l1']!.evidence).toEqual(['kbis']);
    expect(r.state.worksheets.master['crossCycle']!.pins).toEqual(['finding:c1']);
    expect(r.state.planning.riskFactors).toEqual([]);
    // nothing left to clean: unchanged
    expect(cleanOrphans(r.state, params, known)).toEqual({ state: r.state, removed: [] });
  });
  it('the samples, recalculations and confirmations of a worksheet removed as an orphan stay, charged on their own', () => {
    const params = loadParams();
    const s0 = fresh();
    const s: GameState = {
      ...s0,
      program: { planned: [], briefings: [], executions: [{ id: 'x2', procedureId: 'procedure-retiree', assignee: 'senior', hours: 4, launchedOn: '2025-11-03', conclusion: null, comment: '', refs: [], seq: 1, reviewRounds: [] }] },
      samples: { items: [{ id: 'smp1', executionId: 'x2', population: 'maintenance-charges', method: 'random', seed: 's1', parameters: {}, items: [], drawnOn: '2025-11-03' }] },
      recalcs: { items: [{ id: 'rc1', executionId: 'x2', tool: 'rent-revision', scope: 'all', assumptions: {}, summary: { computed: 0, recorded: 0 }, on: '2025-11-03' }] },
      confirmations: { items: [{ thirdParty: 'BDT', preparedOn: '2025-11-03', executionId: 'x2' }] },
    };
    const r = cleanOrphans(s, params, () => true);
    expect(r.state.program.executions).toEqual([]);
    expect(r.state.samples.items.map((x) => x.executionId)).toEqual([null]);
    expect(r.state.recalcs.items.map((x) => x.executionId)).toEqual([null]);
    expect(r.state.confirmations.items).toEqual([{ thirdParty: 'BDT', preparedOn: '2025-11-03' }]);
    expect(hoursUsed(r.state, params).team).toBe(params.sampling.drawHours + params.sampling.recalcHours + params.requests.confirmations.preparationHours);
  });
  it('restarts a J3 game (schema 1) at the beginning of the engagement, keeping settings, tick marks and saved queries', () => {
    const v1 = {
      schemaVersion: 1,
      scenarioId: 'val-aurelle-2025',
      difficulty: 'senior',
      clock: { date: '2026-02-23' },
      settings: { theme: 'dark', designer: true },
      documents: { 'doc-a': { readOn: '2026-02-23', annotations: [], evidence: true } },
      ticks: { 'etats:P_CP:n': 'balance' },
      tickMarks: [{ id: 'mark9', symbol: '¤', label: 'Vu', tone: 'ok' }],
      savedQueries: [{ id: 'query3', name: 'Q', query: { ...EMPTY_QUERY, keywords: 'x' }, createdOn: '2026-02-23' }],
      journal: [{ on: '2026-02-23', kind: 'documentRead', detail: 'doc-a' }],
      seq: 9,
    };
    const r = deserialize(JSON.stringify(v1), fresh());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.migratedFrom).toBe(1);
    expect(r.restarted).toBe(true);
    expect(r.state.clock.date).toBe(fresh().clock.date);
    expect(r.state.settings).toEqual({ theme: 'dark', designer: true });
    expect(r.state.tickMarks.map((m) => m.id)).toEqual(['mark9']);
    expect(r.state.savedQueries.map((q) => q.id)).toEqual(['query3']);
    expect(r.state.seq).toBe(9);
    expect(r.state.documents).toEqual({});
    expect(r.state.journal).toEqual([]);
  });
});

describe('calendar', () => {
  const cal = loadParams().game.calendar;
  it('finds the current period, or the surrounding ones between periods', () => {
    expect(periodAt(cal, '2025-11-18').current?.id).toBe('interim');
    const gap = periodAt(cal, '2025-12-10');
    expect(gap.current).toBeUndefined();
    expect(gap.previous?.id).toBe('interim');
    expect(gap.next?.id).toBe('confirmations');
    expect(periodAt(cal, '2026-02-23').current?.id).toBe('final');
  });
});
