/**
 * Game state (J3: consultation layer) and pure actions. Everything the player
 * does is here; generated scenario data is never saved. The UI store only
 * calls these functions (state, action → new state).
 */
import type { IsoDate } from '../engine/dates';
import type { Params } from '../scenario/params';
import { EMPTY_QUERY, type FecQuery } from './fec-query';

export const SCHEMA_VERSION = 1;

export type Difficulty = 'assistant' | 'senior' | 'manager';
export type ThemeChoice = 'system' | 'light' | 'dark';
export type Tone = 'ok' | 'ko' | 'accent' | 'warn' | 'muted';

export interface Annotation {
  id: string;
  text: string;
  /** Index of the annotated block in the document (whole document when absent). */
  block?: number;
  createdOn: IsoDate;
}

export interface DocumentState {
  readOn?: IsoDate;
  annotations: Annotation[];
  /** Kept as audit evidence (linked to findings in J4). */
  evidence: boolean;
}

export interface TickMark {
  id: string;
  symbol: string;
  label: string;
  tone: Tone;
}

export interface SavedQuery {
  id: string;
  name: string;
  query: FecQuery;
  createdOn: IsoDate;
}

export interface JournalEvent {
  on: IsoDate;
  kind: 'documentRead' | 'evidence' | 'annotation' | 'query' | 'tick' | 'setting';
  detail: string;
}

export interface GameState {
  schemaVersion: number;
  scenarioId: string;
  difficulty: Difficulty;
  clock: { date: IsoDate };
  settings: { theme: ThemeChoice; designer: boolean };
  documents: Record<string, DocumentState>;
  /** Ticking marks by cell ('statement:rowId:column' or 'annex:table:rowId:column'). */
  ticks: Record<string, string>;
  tickMarks: TickMark[];
  savedQueries: SavedQuery[];
  /** Chronological log of the player's actions (debrief). */
  journal: JournalEvent[];
  /** Counter for ids (deterministic, no randomness). */
  seq: number;
}

export const DEFAULT_TICK_MARKS: readonly TickMark[] = [
  { id: 'balance', symbol: '✓', label: 'Concordé avec la balance', tone: 'ok' },
  { id: 'certified', symbol: 'Ⓒ', label: 'Pointé sur les comptes certifiés 2024', tone: 'accent' },
  { id: 'total', symbol: 'Σ', label: 'Total vérifié', tone: 'muted' },
  { id: 'gap', symbol: '≠', label: 'Écart à analyser', tone: 'ko' },
  { id: 'review', symbol: '?', label: 'À revoir', tone: 'warn' },
];

export function initialState(params: Params, difficulty: Difficulty = 'senior'): GameState {
  return {
    schemaVersion: SCHEMA_VERSION,
    scenarioId: 'val-aurelle-2025',
    difficulty,
    clock: { date: params.game.startDate },
    settings: { theme: 'system', designer: false },
    documents: {},
    ticks: {},
    tickMarks: DEFAULT_TICK_MARKS.map((m) => ({ ...m })),
    savedQueries: [],
    journal: [],
    seq: 0,
  };
}

// ---------------------------------------------------------------------------
// actions
// ---------------------------------------------------------------------------

function nextId(s: GameState, prefix: string): [string, GameState] {
  const seq = s.seq + 1;
  return [`${prefix}${seq}`, { ...s, seq }];
}

function log(s: GameState, kind: JournalEvent['kind'], detail: string): GameState {
  return { ...s, journal: [...s.journal, { on: s.clock.date, kind, detail }] };
}

function docState(s: GameState, id: string): DocumentState {
  return s.documents[id] ?? { annotations: [], evidence: false };
}

function withDoc(s: GameState, id: string, d: DocumentState): GameState {
  return { ...s, documents: { ...s.documents, [id]: d } };
}

export function markRead(s: GameState, docId: string): GameState {
  const d = docState(s, docId);
  if (d.readOn) return s;
  return log(withDoc(s, docId, { ...d, readOn: s.clock.date }), 'documentRead', docId);
}

export function addAnnotation(s: GameState, docId: string, text: string, block?: number): GameState {
  const clean = text.trim();
  if (!clean) return s;
  const [id, s1] = nextId(s, 'note');
  const d = docState(s1, docId);
  const a: Annotation = { id, text: clean, createdOn: s1.clock.date, ...(block !== undefined ? { block } : {}) };
  return log(withDoc(s1, docId, { ...d, annotations: [...d.annotations, a] }), 'annotation', docId);
}

export function removeAnnotation(s: GameState, docId: string, annotationId: string): GameState {
  const d = docState(s, docId);
  return withDoc(s, docId, { ...d, annotations: d.annotations.filter((a) => a.id !== annotationId) });
}

export function toggleEvidence(s: GameState, docId: string): GameState {
  const d = docState(s, docId);
  return log(withDoc(s, docId, { ...d, evidence: !d.evidence }), 'evidence', `${docId}:${!d.evidence ? 'ajout' : 'retrait'}`);
}

export function setTick(s: GameState, cell: string, markId: string | null): GameState {
  const ticks = { ...s.ticks };
  if (markId === null) delete ticks[cell];
  else {
    if (!s.tickMarks.some((m) => m.id === markId)) return s;
    ticks[cell] = markId;
  }
  return { ...s, ticks };
}

export function addTickMark(s: GameState, mark: Omit<TickMark, 'id'>): GameState {
  const symbol = mark.symbol.trim();
  const label = mark.label.trim();
  if (!symbol || !label) return s;
  const [id, s1] = nextId(s, 'mark');
  return { ...s1, tickMarks: [...s1.tickMarks, { id, symbol, label, tone: mark.tone }] };
}

export function updateTickMark(s: GameState, id: string, changes: Partial<Omit<TickMark, 'id'>>): GameState {
  return { ...s, tickMarks: s.tickMarks.map((m) => (m.id === id ? { ...m, ...changes } : m)) };
}

/** Removes a mark and every tick that uses it. */
export function removeTickMark(s: GameState, id: string): GameState {
  const ticks: Record<string, string> = {};
  for (const [cell, m] of Object.entries(s.ticks)) if (m !== id) ticks[cell] = m;
  return { ...s, tickMarks: s.tickMarks.filter((m) => m.id !== id), ticks };
}

export function saveQuery(s: GameState, name: string, query: FecQuery): GameState {
  const clean = name.trim();
  if (!clean) return s;
  const [id, s1] = nextId(s, 'query');
  return log({ ...s1, savedQueries: [...s1.savedQueries, { id, name: clean, query: { ...EMPTY_QUERY, ...query }, createdOn: s1.clock.date }] }, 'query', clean);
}

export function deleteQuery(s: GameState, id: string): GameState {
  return { ...s, savedQueries: s.savedQueries.filter((q) => q.id !== id) };
}

export function setTheme(s: GameState, theme: ThemeChoice): GameState {
  return { ...s, settings: { ...s.settings, theme } };
}

export function setDesigner(s: GameState, designer: boolean): GameState {
  return { ...s, settings: { ...s.settings, designer } };
}
