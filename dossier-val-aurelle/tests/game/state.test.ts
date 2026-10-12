/** Game state actions, persistence and calendar (pure). */
import { describe, expect, it } from 'vitest';
import { periodAt } from '../../src/game/clock';
import { EMPTY_QUERY } from '../../src/game/fec-query';
import { deserialize, serialize } from '../../src/game/persistence';
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
    const r = deserialize(serialize(s), s.scenarioId);
    expect(r.ok && r.state).toEqual(s);
    expect(deserialize('{', s.scenarioId).ok).toBe(false);
    expect(deserialize(serialize(s), 'autre-dossier').ok).toBe(false);
    expect(deserialize(JSON.stringify({ ...s, schemaVersion: 99 }), s.scenarioId).ok).toBe(false);
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
