/**
 * Game state and pure actions. Everything the player does is here; generated
 * scenario data is never saved, and what can be derived (phase, arrivals,
 * hours, matching) is not stored. The UI store only calls these functions
 * (state, action → new state).
 *
 * J3 sections (documents, ticking, saved queries) live here; the J4 sections
 * each have their own module (types, initial value, save schema, actions):
 * planning, program, worksheets, requests, confirmations, samples, recalcs,
 * findings, gauges.
 */
import type { IsoDate } from '../engine/dates';
import { SCENARIO_HASH } from '../scenario/fingerprint';
import type { Params } from '../scenario/params';
import { initialConfirmations, type ConfirmationsState } from './confirmations';
import { EMPTY_QUERY, type FecQuery } from './fec-query';
import { initialFindings, type FindingsState } from './findings';
import { initialGauges, type GaugesState } from './gauges';
import { initialPlanning, type PlanningState } from './planning';
import { initialProgram, type ProgramState } from './program';
import { initialRecalcs, type RecalcsState } from './recalcs';
import { initialRequests, type RequestsState } from './requests';
import { initialSamples, type SamplesState } from './samples';
import { initialWorksheets, type WorksheetsState } from './worksheets';

export const SCHEMA_VERSION = 2;

/**
 * Version of the game content (procedure and request catalogues, documents,
 * anomaly parts): bumped when a change can leave saved references orphaned.
 */
export const CONTENT_VERSION = 1;

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

/** Kinds of the journal events (chronology of the debrief); open list, completed by the J4-J6 sections. */
export type JournalKind = 'documentRead' | 'evidence' | 'annotation' | 'query' | 'tick' | 'setting' | 'clock' | (string & {});

export interface JournalEvent {
  on: IsoDate;
  kind: JournalKind;
  /** Object of the event (document id, query name, procedure id…). */
  ref?: string;
  data?: Record<string, string | number | boolean>;
}

export interface GameState {
  schemaVersion: number;
  scenarioId: string;
  /** Fingerprint of the generated world the save was made with (scenario.lock.json). */
  scenarioHash: string;
  contentVersion: number;
  difficulty: Difficulty;
  /** Game date; dated effects are applied up to `processedUntil` (game/advance.ts). */
  clock: { date: IsoDate; processedUntil: IsoDate };
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
  // --- J4 sections -------------------------------------------------------------
  planning: PlanningState;
  program: ProgramState;
  worksheets: WorksheetsState;
  requests: RequestsState;
  confirmations: ConfirmationsState;
  samples: SamplesState;
  recalcs: RecalcsState;
  findings: FindingsState;
  gauges: GaugesState;
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
    scenarioHash: SCENARIO_HASH,
    contentVersion: CONTENT_VERSION,
    difficulty,
    clock: { date: params.game.startDate, processedUntil: params.game.startDate },
    settings: { theme: 'system', designer: false },
    documents: {},
    ticks: {},
    tickMarks: DEFAULT_TICK_MARKS.map((m) => ({ ...m })),
    savedQueries: [],
    journal: [],
    seq: 0,
    planning: initialPlanning(),
    program: initialProgram(),
    worksheets: initialWorksheets(),
    requests: initialRequests(),
    confirmations: initialConfirmations(),
    samples: initialSamples(),
    recalcs: initialRecalcs(),
    findings: initialFindings(),
    gauges: initialGauges(),
  };
}

// ---------------------------------------------------------------------------
// actions
// ---------------------------------------------------------------------------

/** New id from the state counter (deterministic). */
export function nextId(s: GameState, prefix: string): [string, GameState] {
  const seq = s.seq + 1;
  return [`${prefix}${seq}`, { ...s, seq }];
}

/** Appends an event to the journal, dated at the game date. */
export function log(s: GameState, kind: JournalKind, ref?: string, data?: JournalEvent['data']): GameState {
  const e: JournalEvent = { on: s.clock.date, kind, ...(ref !== undefined ? { ref } : {}), ...(data ? { data } : {}) };
  return { ...s, journal: [...s.journal, e] };
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
  return log(withDoc(s, docId, { ...d, evidence: !d.evidence }), 'evidence', docId, { kept: !d.evidence });
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
