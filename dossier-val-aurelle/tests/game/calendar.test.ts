/** Working calendar of the game: working days, presence on site, scheduling of the members' work. */
import { describe, expect, it } from 'vitest';
import { addWorkingDays, isOnSite, isWorkingDay, nextWorkingDay, schedule, workCalendar, type WorkCalendar } from '../../src/game/calendar';
import { loadParams } from '../../src/scenario/params';

const cal = workCalendar(loadParams());

describe('working days', () => {
  it('skips weekends and public holidays', () => {
    expect(isWorkingDay(cal, '2025-11-11')).toBe(false); // Armistice
    expect(isWorkingDay(cal, '2025-11-15')).toBe(false); // Saturday
    expect(isWorkingDay(cal, '2025-11-12')).toBe(true);
    expect(nextWorkingDay(cal, '2025-11-10')).toBe('2025-11-12');
    expect(addWorkingDays(cal, '2025-12-24', 1)).toBe('2025-12-26');
    expect(addWorkingDays(cal, '2025-12-31', 1)).toBe('2026-01-02');
    expect(addWorkingDays(cal, '2025-11-15', 0)).toBe('2025-11-17');
  });
  it('the senior is on site at the planning, the team only at the interim and the final', () => {
    expect(isOnSite(cal, 'senior', '2025-11-04')).toBe(true);
    expect(isOnSite(cal, 'lea', '2025-11-04')).toBe(false);
    expect(isOnSite(cal, 'lea', '2025-11-18')).toBe(true);
    expect(isOnSite(cal, 'hugo', '2025-12-10')).toBe(false); // off site between the interim and the final
    expect(isOnSite(cal, 'senior', '2026-04-15')).toBe(true); // reporting period
    expect(isOnSite(cal, 'lea', '2026-04-15')).toBe(false);
  });
});

describe('schedule', () => {
  it('fills each working day on site up to the capacity, in launch order, member by member', () => {
    const s = schedule(cal, [
      { id: 'a', member: 'lea', hours: 10, earliest: '2025-11-17' },
      { id: 'b', member: 'lea', hours: 4, earliest: '2025-11-17' },
      { id: 'c', member: 'hugo', hours: 3, earliest: '2025-11-17' },
    ]);
    expect(s.map((t) => [t.id, t.start, t.end])).toEqual([
      ['a', '2025-11-17', '2025-11-18'], // 7 h on Monday, 3 h on Tuesday
      ['b', '2025-11-18', '2025-11-18'], // 4 more hours on Tuesday (3 + 4 = 7)
      ['c', '2025-11-17', '2025-11-17'],
    ]);
  });
  it('waits for the next stay on site and reports work that cannot be finished', () => {
    const s = schedule(cal, [
      { id: 'a', member: 'lea', hours: 30, earliest: '2025-11-19' }, // 2 days at the interim, then the final
      { id: 'b', member: 'hugo', hours: 200, earliest: '2026-03-12' }, // the final ends on 13/03: never finished
      { id: 'c', member: 'hugo', hours: 1, earliest: '2026-03-12' },
    ]);
    expect(s[0]).toMatchObject({ start: '2025-11-19', end: '2026-02-25' }); // 14 h at the interim, 16 h from 23/02
    expect(s[1]).toMatchObject({ start: '2026-03-12', end: null });
    expect(s[2]).toMatchObject({ start: null, end: null });
  });
  it('a launch off site starts at the next stay on site; a task launched later never starts earlier', () => {
    const small: WorkCalendar = { ...cal, capacityHoursPerDay: 7 };
    const s = schedule(small, [
      { id: 'a', member: 'lea', hours: 2, earliest: '2025-12-10' },
      { id: 'b', member: 'senior', hours: 7, earliest: '2025-11-14' },
      { id: 'c', member: 'senior', hours: 1, earliest: '2025-11-14' },
    ]);
    expect(s[0]).toMatchObject({ start: '2026-02-23', end: '2026-02-23' });
    expect(s[1]).toMatchObject({ start: '2025-11-14', end: '2025-11-14' });
    expect(s[2]).toMatchObject({ start: '2025-11-17', end: '2025-11-17' }); // the 14th is full
  });
});
