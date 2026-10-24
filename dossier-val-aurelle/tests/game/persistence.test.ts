/** Save format v3 (plan J5 §14, J5-29): migrations 2 → 3 and 1 → 3, `restarted`, sections of J5. Pure. */
import { describe, expect, it } from 'vitest';
import { EMPTY_QUERY } from '../../src/game/fec-query';
import { deserialize, serialize } from '../../src/game/persistence';
import { CONTENT_VERSION, initialState, SCHEMA_VERSION, type GameState } from '../../src/game/state';
import { loadParams } from '../../src/scenario/params';

const params = loadParams();
const fresh = (): GameState => initialState(params);

/** A save of J4 (schema 2), as JSON: a review of J4, findings (one escalated), gauge events without numbers. */
function v2Save(): Record<string, unknown> {
  const { interviews: _i, consulted: _c, ethics: _e, messages: _m, ...rest } = fresh();
  return {
    ...rest,
    schemaVersion: 2,
    contentVersion: 1,
    clock: { date: '2026-02-25', processedUntil: '2026-02-25' },
    seq: 41,
    program: {
      planned: [{ procedureId: 'board-minutes', assignee: 'lea' }],
      executions: [
        { id: 'exec12', procedureId: 'board-minutes', assignee: 'lea', hours: 6, launchedOn: '2025-11-17', conclusion: 'satisfactory', comment: '', refs: [], review: { status: 'returned', on: '2025-11-20', comment: 'Compléter' } },
        { id: 'manual', procedureId: 'payroll', assignee: 'senior', hours: 8, launchedOn: '2025-11-18', conclusion: null, comment: '', refs: [], review: { status: 'pending' } },
      ],
    },
    findings: {
      items: [
        {
          id: 'C30',
          title: 'Remonté',
          cycle: 'crossCycle',
          objects: [],
          natures: [],
          classification: 'factual',
          treatments: ['adjust'],
          proposedEntry: [
            { account: '7088', debit: 100, credit: 0 },
            { account: '4687', debit: 0, credit: 100 },
          ],
          disclosureFix: null,
          evidence: [{ kind: 'doc', docId: 'kbis' }],
          status: 'finding',
          history: [{ on: '2026-02-24', status: 'finding' }],
          escalatedToPartnerOn: '2026-02-25',
          comment: '',
          createdOn: '2026-02-24',
        },
        { id: 'C31', title: '', cycle: 'crossCycle', objects: [], natures: [], classification: 'factual', treatments: [], proposedEntry: [], disclosureFix: null, evidence: [], status: 'question', history: [{ on: '2026-02-25', status: 'question' }], escalatedToPartnerOn: null, comment: '', createdOn: '2026-02-25' },
      ],
    },
    gauges: {
      events: [
        { on: '2025-11-17', gauge: 'partnerTrust', reason: 'interimWithoutPlanning', ref: 'program' },
        { on: '2025-11-05', gauge: 'clientRelation', reason: 'duplicateRequest', ref: 'interim-extraction' },
      ],
      arbitrations: [],
    },
  };
}

describe('save format v3', () => {
  it('is version 3 with the content version 2 and the sections of J5; round-trips', () => {
    expect(SCHEMA_VERSION).toBe(3);
    expect(CONTENT_VERSION).toBe(2);
    const s = fresh();
    expect(s.interviews).toEqual({ sessions: [] });
    expect(s.consulted).toEqual({});
    expect(s.ethics).toEqual({ choices: {}, notes: {} });
    expect(s.messages).toEqual({ read: {} });
    expect(s.program.briefings).toEqual([]);
    const full: GameState = {
      ...s,
      consulted: { 'acct:4687': '2025-11-05', 'fec:2025:OD000189': '2026-02-24' },
      messages: { read: { 'partner-planning': '2025-11-03' } },
      ethics: { choices: { E1: { on: '2025-11-19', seq: 4, option: 'decline' } }, notes: { E1: { on: '2025-11-19', seq: 5, text: 'Note' } } },
      interviews: {
        sessions: [
          {
            id: 'session6',
            seq: 6,
            person: 'chiefAccountant',
            on: '2025-11-18',
            audience: 'alone',
            actions: [
              { kind: 'ask', seq: 7, question: 'chiefAccountant:entry:2025:OD000189', variant: 'full' },
              { kind: 'present', seq: 8, topic: 'entry:2025:OD000189', evidence: { kind: 'fec', year: 2025, num: 'OD000189' }, outcome: 'position' },
              { kind: 'insist', seq: 9, topic: 'entry:2025:OD000189', outcome: 'holds' },
              { kind: 'accuse', seq: 10, topic: 'entry:2025:OD000189', founded: false },
            ],
            closed: true,
          },
        ],
        karim: { confidedOn: '2026-02-26', seq: 11, response: { on: '2026-02-26', seq: 12, option: 'thank' } },
      },
      program: { ...s.program, briefings: [{ member: 'lea', phase: 'interim', point: 'reconcile', on: '2025-11-17', seq: 3 }] },
    };
    const r = deserialize(serialize(full), fresh());
    expect(r.ok && r.state).toEqual(full);
    expect(r.ok && (r.migratedFrom ?? r.restarted ?? r.contentChanged)).toBeFalsy();
  });

  it('migrates a save of J4: reviews dropped, launches and gauge events numbered, flags and snapshots added, sections of J5 new', () => {
    const r = deserialize(JSON.stringify(v2Save()), fresh());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.migratedFrom).toBe(2);
    expect(r.restarted).toBeUndefined();
    // the content version moved: the orphans are cleaned and the change is reported once
    expect(r.contentChanged).toBe(true);
    const s = r.state;
    expect(s.schemaVersion).toBe(3);
    expect(s.clock.date).toBe('2026-02-25');
    expect(s.seq).toBe(41);
    expect(s.program.executions.map((e) => [e.id, e.seq, e.reviewRounds])).toEqual([
      ['exec12', 12, []],
      ['manual', 2, []],
    ]);
    expect(s.program.executions.every((e) => !('review' in e))).toBe(true);
    expect(s.program.briefings).toEqual([]);
    expect(s.findings.items.map((f) => f.suspicion)).toEqual([false, false]);
    expect(s.findings.items[0]!.escalation).toEqual({ on: '2026-02-25', seq: 30, evidence: [{ kind: 'doc', docId: 'kbis' }], magnitude: 0, status: 'finding', hasEntry: true, suspicion: false });
    expect(s.findings.items[1]!.escalation).toBeUndefined();
    expect(s.gauges.events.map((e) => [e.reason, e.seq])).toEqual([
      ['interimWithoutPlanning', 1],
      ['duplicateRequest', 2],
    ]);
    expect(s.interviews).toEqual({ sessions: [] });
    expect(s.consulted).toEqual({});
    expect(s.ethics).toEqual({ choices: {}, notes: {} });
    expect(s.messages).toEqual({ read: {} });
    // the journal keeps what the review of J4 recorded: nothing else is lost
    const again = deserialize(serialize(s), fresh());
    expect(again.ok && again.state).toEqual(s);
  });

  it('restarts a save of J3 (schema 1) on a fresh state of version 3, and only then', () => {
    const v1 = {
      schemaVersion: 1,
      scenarioId: 'val-aurelle-2025',
      difficulty: 'senior',
      clock: { date: '2026-02-23' },
      settings: { theme: 'dark', designer: false },
      documents: {},
      ticks: {},
      tickMarks: [{ id: 'mark9', symbol: '¤', label: 'Vu', tone: 'ok' }],
      savedQueries: [{ id: 'query3', name: 'Q', query: { ...EMPTY_QUERY, keywords: 'x' }, createdOn: '2026-02-23' }],
      journal: [],
      seq: 9,
    };
    const r = deserialize(JSON.stringify(v1), fresh());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.restarted).toBe(true);
    expect(r.migratedFrom).toBe(1);
    expect(r.state.schemaVersion).toBe(3);
    expect(r.state.interviews).toEqual(fresh().interviews);
    expect(r.state.program).toEqual(fresh().program);
    expect(r.state.seq).toBe(9);
    expect(r.state.savedQueries.map((q) => q.id)).toEqual(['query3']);
  });

  it('refuses a save of J4 whose shape does not match the schema after the migration', () => {
    const broken = { ...v2Save(), program: 'illisible' };
    expect(deserialize(JSON.stringify(broken), fresh())).toEqual({ ok: false, reason: 'sauvegarde invalide' });
  });
});
