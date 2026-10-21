/** Clock of the game (plan J4 §5): moves, upcoming events, next event. Pure rules. */
import { describe, expect, it } from 'vitest';
import { advanceOneDay, advanceTo, nextEventDate, upcomingEvents, type UpcomingContext } from '../../src/game/advance';
import { workCalendar } from '../../src/game/calendar';
import { sendRequest } from '../../src/game/requests';
import { initialState, type GameState } from '../../src/game/state';
import { vintageDates } from '../../src/game/vintages';
import { loadParams } from '../../src/scenario/params';

const params = loadParams();
const cal = workCalendar(params);
const ctx = (s: GameState): UpcomingContext => ({ params, cal, date: s.clock.date });
const extraction = params.game.dataVintages.interim.request;

describe('moving the clock', () => {
  it('records the move in the journal and keeps the furthest date processed', () => {
    const s0 = initialState(params, 'senior');
    expect(advanceTo(s0, s0.clock.date)).toBe(s0);
    const s1 = advanceTo(s0, '2025-11-17');
    expect(s1.clock).toEqual({ date: '2025-11-17', processedUntil: '2025-11-17' });
    expect(s1.journal.at(-1)).toMatchObject({ on: '2025-11-17', kind: 'clock' });
    expect(advanceTo(s1, '2025-11-05').clock).toEqual({ date: '2025-11-05', processedUntil: '2025-11-17' });
    expect(advanceOneDay(advanceTo(s0, '2025-11-10'), cal).clock.date).toBe('2025-11-12'); // 11/11 is a public holiday
  });
});

describe('upcoming events', () => {
  it('lists the calendar and the data vintages after the date, in date order', () => {
    const s = initialState(params, 'senior');
    const ev = upcomingEvents(s, ctx(s));
    expect(ev.every((e) => e.date > s.clock.date)).toBe(true);
    expect(ev.map((e) => e.date)).toEqual([...ev.map((e) => e.date)].sort());
    const v = vintageDates(params);
    expect(ev.some((e) => e.kind === 'data' && e.date === v.interimDelivered)).toBe(true);
    expect(nextEventDate(s, ctx(s))).toBe(ev[0]!.date);
  });
  it('no longer announces the handover of the extraction once it was obtained on request', () => {
    let s = sendRequest(initialState(params, 'senior'), extraction, '', params);
    const v = vintageDates(params);
    const handover = (x: GameState) => upcomingEvents(x, ctx(x)).some((e) => e.kind === 'data' && e.date === v.interimDelivered);
    expect(handover(s)).toBe(true);
    s = advanceTo(s, nextEventDate(s, ctx(s)));
    expect(s.clock.date < v.interimDelivered).toBe(true);
    expect(handover(s)).toBe(false);
  });
  it('the next event is the next working day when nothing is expected', () => {
    const s = advanceTo(initialState(params, 'senior'), '2026-12-28');
    expect(upcomingEvents(s, ctx(s))).toEqual([]);
    expect(nextEventDate(s, ctx(s))).toBe('2026-12-29');
  });
});
