/** Values of the gauges derived from the events (plan J5 §10.1, J5-17, J5-18): order, rounding, bounds, repetitions, multipliers, recovery. Pure rules. */
import { describe, expect, it } from 'vitest';
import { addWorkingDays, workCalendar, workingDaysBetween } from '../../src/game/calendar';
import {
  compareGaugeEvents,
  GAUGE_PROVIDERS,
  GAUGE_SECTIONS,
  gaugeHistory,
  gaugeReport,
  gaugeRules,
  gaugeValues,
  J4_GAUGE_EFFECTS,
  relationLow,
  roundEffect,
  type GaugeRules,
} from '../../src/game/gauge-values';
import type { GaugeEvent } from '../../src/game/gauges';
import { initialState, type GameState } from '../../src/game/state';
import { loadParams } from '../../src/scenario/params';

const params = loadParams();
const cal = workCalendar(params);
const fresh = (difficulty: GameState['difficulty'] = 'senior'): GameState => initialState(params, difficulty);
const withEvents = (events: GaugeEvent[], difficulty: GameState['difficulty'] = 'senior'): GameState => {
  const s = fresh(difficulty);
  return { ...s, gauges: { ...s.gauges, events } };
};
const ev = (on: string, reason: string, seq: number, gauge: GaugeEvent['gauge'] = 'clientRelation'): GaugeEvent => ({ on, gauge, reason, seq });

describe('gauge values', () => {
  it('start from the values of params/game.json, without any event', () => {
    const s = fresh();
    const g = params.game.gauges;
    expect(gaugeValues(s, params, s.clock.date)).toEqual({ clientRelation: g.clientRelation.initial, partnerTrust: g.partnerTrust.initial, karimTrust: g.karimTrust.initial });
    expect(gaugeHistory(s, params, s.clock.date)).toEqual([]);
  });

  it('apply the effects of the events recorded by J4, after their date only (a clock moved back hides the later ones)', () => {
    const s = withEvents([ev('2025-11-05', 'duplicateRequest', 3), ev('2025-11-17', 'interimWithoutPlanning', 7, 'partnerTrust'), ev('2026-02-24', 'unjustifiedOverrun', 20, 'partnerTrust'), ev('2026-02-25', 'aidUsed', 21, 'partnerTrust')]);
    const g = params.game.gauges;
    expect(gaugeValues(s, params, '2025-11-04')).toEqual(gaugeValues(fresh(), params, '2025-11-04'));
    expect(gaugeValues(s, params, '2025-11-05').clientRelation).toBe(g.clientRelation.initial - 2);
    expect(gaugeValues(s, params, '2025-12-01').partnerTrust).toBe(g.partnerTrust.initial - 10);
    expect(gaugeValues(s, params, '2026-03-01').partnerTrust).toBe(g.partnerTrust.initial - 10 - 8 - 3);
    const history = gaugeHistory(s, params, '2026-03-01');
    expect(history.map((h) => [h.reason, h.delta])).toEqual([
      ['duplicateRequest', -2],
      ['interimWithoutPlanning', -10],
      ['unjustifiedOverrun', -8],
      ['aidUsed', -3],
    ]);
    expect(history.map((h) => h.label)).toEqual(['duplicateRequest', 'interimWithoutPlanning', 'unjustifiedOverrun', 'aidUsed'].map((k) => J4_GAUGE_EFFECTS[k]!.label));
  });

  it('bound the value between 0 and 100 after each effect, in the order (date, number): 98 + 3 − 5 = 95', () => {
    const rules: GaugeRules = { ...gaugeRules(params), initial: { clientRelation: 70, partnerTrust: 98, karimTrust: 20 }, effects: { up: { delta: 3, label: 'Hausse' }, down: { delta: -5, label: 'Baisse' } } };
    const up = ev('2025-11-05', 'up', 4, 'partnerTrust');
    const down = ev('2025-11-05', 'down', 5, 'partnerTrust');
    // stored in the reverse order: the number decides
    const s = withEvents([down, up]);
    expect(gaugeValues(s, params, '2025-11-05', cal, rules).partnerTrust).toBe(95);
    expect(gaugeHistory(s, params, '2025-11-05', cal, rules).map((h) => [h.reason, h.effect, h.delta, h.value])).toEqual([
      ['up', 3, 2, 100],
      ['down', -5, -5, 95],
    ]);
    // the other order gives 96: the bounds apply event by event
    const reversed = withEvents([{ ...down, seq: 4 }, { ...up, seq: 5 }]);
    expect(gaugeValues(reversed, params, '2025-11-05', cal, rules).partnerTrust).toBe(96);
    // the date comes first
    const dated = withEvents([{ ...up, on: '2025-11-06', seq: 1 }, { ...down, seq: 9 }]);
    expect(gaugeValues(dated, params, '2025-11-06', cal, rules).partnerTrust).toBe(96);
    // never below 0
    const low: GaugeRules = { ...rules, initial: { ...rules.initial, partnerTrust: 2 } };
    expect(gaugeValues(withEvents([down]), params, '2025-11-05', cal, low).partnerTrust).toBe(0);
  });

  it('orders the events of a same day and number by the rank of their provider, then by their position', () => {
    const e = (seq: number) => ({ on: '2025-11-05', seq, gauge: 'clientRelation' as const, reason: 'x' });
    const list = [
      { e: e(2), rank: 0, index: 0 },
      { e: e(1), rank: 3, index: 0 },
      { e: e(1), rank: 1, index: 1 },
      { e: e(1), rank: 1, index: 0 },
      { e: { ...e(0), on: '2025-11-04' }, rank: 4, index: 0 },
    ];
    expect([...list].sort(compareGaugeEvents).map((x) => [x.e.on, x.e.seq, x.rank, x.index])).toEqual([
      ['2025-11-04', 0, 4, 0],
      ['2025-11-05', 1, 1, 0],
      ['2025-11-05', 1, 1, 1],
      ['2025-11-05', 1, 3, 0],
      ['2025-11-05', 2, 0, 0],
    ]);
  });

  it('rounds each effect once to an integer, half away from zero', () => {
    expect([2.5, -2.5, -0.5, 0.5, 1.4, -1.4, -4.5, 0].map(roundEffect)).toEqual([3, -3, -1, 1, 1, -1, -5, 0]);
    // at the assistant level the losses of the client relation are halved: −2 → −1, −1 → −0.5 → −1
    const s = withEvents([ev('2025-11-05', 'duplicateRequest', 1), ev('2025-11-06', 'duplicateRequest', 2)], 'assistant');
    expect(gaugeHistory(s, params, '2025-11-06').map((h) => h.effect)).toEqual([-1, -1]);
    // the partner's trust is not concerned by the factor
    const p = withEvents([ev('2025-11-05', 'aidUsed', 1, 'partnerTrust')], 'assistant');
    expect(gaugeHistory(p, params, '2025-11-05').map((h) => h.effect)).toEqual([-3]);
  });

  it('counts the requests on a cycle without risk from the fourth of a phase, in the order of the events', () => {
    const planning = [1, 2, 3, 4].map((i) => ev('2025-11-0' + (3 + i), 'unrelatedRequest', i));
    const interim = [ev('2025-11-18', 'unrelatedRequest', 10), ev('2025-11-19', 'unrelatedRequest', 11)];
    const s = withEvents([...planning, ...interim]);
    const h = gaugeHistory(s, params, '2025-11-20');
    expect(h.map((x) => [x.on, x.delta])).toEqual([['2025-11-07', -1]]);
    expect(gaugeValues(s, params, '2025-11-20').clientRelation).toBe(params.game.gauges.clientRelation.initial - 1);
  });

  it('lets the client relation recover towards its target after ten working days without a negative event, without walking the days', () => {
    const drop = Array.from({ length: 12 }, (_, i) => ev('2025-11-05', 'duplicateRequest', i + 1));
    const s = withEvents(drop);
    const v0 = params.game.gauges.clientRelation.initial - 24;
    expect(v0).toBeLessThan(50);
    const at = (n: number) => gaugeValues(s, params, addWorkingDays(cal, '2025-11-05', n)).clientRelation;
    expect(at(10)).toBe(v0);
    expect(at(11)).toBe(v0 + 1);
    expect(at(13)).toBe(v0 + 3);
    expect(at(50)).toBe(50);
    // a recovery dated by the last day it rises, then nothing above the target
    const h = gaugeHistory(s, params, addWorkingDays(cal, '2025-11-05', 50));
    const rec = h.filter((x) => x.reason === 'relationRecovery');
    expect(rec).toHaveLength(1);
    expect(rec[0]).toMatchObject({ delta: 50 - v0, value: 50, on: addWorkingDays(cal, '2025-11-05', 10 + 50 - v0) });
    // a new negative event restarts the count; the recovery before it is kept
    const again = withEvents([...drop, ev(addWorkingDays(cal, '2025-11-05', 12), 'duplicateRequest', 30)]);
    const after = (n: number) => gaugeValues(again, params, addWorkingDays(cal, '2025-11-05', 12 + n)).clientRelation;
    expect(after(0)).toBe(v0 + 2 - 2);
    expect(after(10)).toBe(v0);
    expect(after(11)).toBe(v0 + 1);
    // a relation above the target does not recover (nor go down to it)
    expect(gaugeValues(withEvents([ev('2025-11-05', 'duplicateRequest', 1)]), params, '2026-03-01').clientRelation).toBe(params.game.gauges.clientRelation.initial - 2);
  });

  it('tells when the client relation is below its low threshold', () => {
    const s = fresh();
    expect(relationLow(s, params, s.clock.date)).toBe(false);
    const drop = Array.from({ length: 21 }, (_, i) => ev('2025-11-05', 'duplicateRequest', i + 1));
    expect(gaugeValues(withEvents(drop), params, '2025-11-05').clientRelation).toBeLessThan(params.game.gauges.clientRelation.lowThreshold);
    expect(relationLow(withEvents(drop), params, '2025-11-05')).toBe(true);
    expect(relationLow(withEvents(drop), params, '2025-11-04')).toBe(false);
  });

  it('reads the providers of the registry; those of J5 give no event yet', () => {
    expect(GAUGE_PROVIDERS.map((p) => p.id)).toEqual(['stored', 'interviews', 'ethics', 'escalations', 'review']);
    const s = withEvents([ev('2025-11-05', 'duplicateRequest', 1)]);
    for (const p of GAUGE_PROVIDERS.slice(1)) expect(p.events(s, { params, cal })).toEqual([]);
    // the sections the providers read are enough to compute the gauges
    const host = Object.fromEntries(GAUGE_SECTIONS.map((k) => [k, s[k]])) as Pick<GameState, (typeof GAUGE_SECTIONS)[number]>;
    expect(gaugeReport(host, params, '2025-11-05')).toEqual(gaugeReport(s, params, '2025-11-05'));
  });
});

describe('working days between two dates', () => {
  it('counts the working days after the first date up to the second, holidays excluded', () => {
    expect(workingDaysBetween(cal, '2025-11-03', '2025-11-03')).toBe(0);
    expect(workingDaysBetween(cal, '2025-11-03', '2025-11-04')).toBe(1);
    // 11/11 is a public holiday; 08 and 09/11 a weekend
    expect(workingDaysBetween(cal, '2025-11-07', '2025-11-12')).toBe(2);
    expect(workingDaysBetween(cal, '2025-11-12', '2025-11-03')).toBe(0);
    // agrees with adding working days, over the whole engagement
    for (const n of [1, 5, 17, 40, 120]) expect(workingDaysBetween(cal, '2025-11-03', addWorkingDays(cal, '2025-11-03', n))).toBe(n);
  });
});
