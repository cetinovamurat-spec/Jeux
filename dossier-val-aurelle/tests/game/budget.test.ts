/** Budget (plan J5 §16): the registry of the hours providers, the providers of J5 still empty, and the numbers (`seq`) of the stored actions. Pure. */
import { describe, expect, it } from 'vitest';
import { askAntoine } from '../../src/game/aid';
import { HOURS_PROVIDERS, HOURS_SECTIONS, hoursUsed } from '../../src/game/budget';
import { workCalendar } from '../../src/game/calendar';
import { conditionContext } from '../../src/game/conditions';
import { hoursCharged as ethicsHours } from '../../src/game/ethics';
import { createFinding, draftFromSeed, escalateFinding } from '../../src/game/findings';
import { hoursCharged as interviewHours } from '../../src/game/interviews';
import { recordInterimWithoutPlanning } from '../../src/game/planning';
import { launchExecution, procedureProgress, type LaunchContext } from '../../src/game/program';
import { sendRequest } from '../../src/game/requests';
import { hoursCharged as reviewHours } from '../../src/game/review';
import { addAnnotation, initialState, nextSeq, type GameState } from '../../src/game/state';
import { loadParams } from '../../src/scenario/params';

const params = loadParams();
const cal = workCalendar(params);
const fresh = (): GameState => initialState(params, 'senior');
const ctx = (s: GameState): LaunchContext => ({ ...conditionContext(s, params, s.clock.date, { procedureProgress: procedureProgress(s.program, cal, s.clock.date) }), cal });

describe('hours used', () => {
  it('aggregate every provider of the registry, those of J5 included (empty until their lots)', () => {
    expect(HOURS_PROVIDERS.map((p) => p.id)).toEqual(['program', 'requests', 'confirmations', 'samples', 'recalcs', 'interviews', 'ethics', 'review']);
    let s = sendRequest(fresh(), 'interim-extraction', '', params);
    s = launchExecution(s, params, 'board-minutes', 'senior', ctx(s));
    const e = s.program.executions[0]!;
    expect(hoursUsed(s, params)).toEqual({ byMember: { senior: params.requests.costHours.request + e.hours, lea: 0, hugo: 0, sofia: 0 }, team: params.requests.costHours.request + e.hours, itAuditor: 0 });
    expect(interviewHours(s.interviews, params)).toEqual([]);
    expect(ethicsHours(s.ethics, params)).toEqual([]);
    expect(reviewHours(s.program, params)).toEqual([]);
    // the sections the providers read are enough
    const host = Object.fromEntries(HOURS_SECTIONS.map((k) => [k, s[k]])) as Pick<GameState, (typeof HOURS_SECTIONS)[number]>;
    expect(hoursUsed(host, params)).toEqual(hoursUsed(s, params));
  });
});

describe('numbers of the stored actions (seq)', () => {
  it('are unique and increasing, shared by the ids and the numbers of the actions', () => {
    let s = addAnnotation(fresh(), 'kbis', 'note');
    const [n, s1] = nextSeq(s);
    expect(n).toBe(s.seq + 1);
    expect(s1.seq).toBe(n);
    s = sendRequest(s1, 'interim-extraction', '', params);
    s = sendRequest(s, 'interim-extraction', '', params);
    s = launchExecution(s, params, 'board-minutes', 'senior', ctx(s));
    s = recordInterimWithoutPlanning(s);
    s = askAntoine(s, params);
    const [s2, id] = createFinding(s, draftFromSeed({ cycle: 'crossCycle' }, params), params);
    s = escalateFinding(s2, id);
    const numbers = [...s.requests.items.map((r) => r.seq!), s.program.executions[0]!.seq, ...s.gauges.events.map((e) => e.seq!), Number(id.slice(1)), s.findings.items[0]!.escalation!.seq];
    // the duplicate request and its gauge event share their number
    const events = s.gauges.events.map((e) => [e.reason, e.seq]);
    expect(events).toEqual([
      ['duplicateRequest', s.requests.items[1]!.seq],
      ['interimWithoutPlanning', s.program.executions[0]!.seq + 1],
      ['aidUsed', s.program.executions[0]!.seq + 2],
    ]);
    const distinct = [...new Set(numbers)];
    expect(distinct).toEqual([...distinct].sort((a, b) => a - b));
    expect(distinct.length).toBe(numbers.length - 1);
    expect(Math.max(...numbers)).toBe(s.seq);
  });
});
