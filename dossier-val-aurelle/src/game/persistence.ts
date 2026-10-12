/**
 * Save format: the game state only (the scenario is regenerated), with a
 * schema version and migrations. Pure functions; the UI handles storage.
 */
import { z } from 'zod';
import { EMPTY_QUERY } from './fec-query';
import { SCHEMA_VERSION, type GameState } from './state';

const tone = z.enum(['ok', 'ko', 'accent', 'warn', 'muted']);
const querySchema = z.object({
  journals: z.array(z.string()),
  accounts: z.array(z.string()),
  aux: z.string(),
  users: z.array(z.string()),
  entryFrom: z.string(),
  entryTo: z.string(),
  validFrom: z.string(),
  validTo: z.string(),
  validatedAfterClosing: z.boolean(),
  weekend: z.enum(['none', 'entry', 'validation', 'either']),
  roundMultiple: z.number().int().min(0),
  keywords: z.string(),
  minAmount: z.number().int().nullable(),
  maxAmount: z.number().int().nullable(),
  rarePairsMax: z.number().int().min(0),
  missingPiece: z.boolean(),
  wholeEntries: z.boolean(),
});

const stateSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  scenarioId: z.string(),
  difficulty: z.enum(['assistant', 'senior', 'manager']),
  clock: z.object({ date: z.string() }),
  settings: z.object({ theme: z.enum(['system', 'light', 'dark']), designer: z.boolean() }),
  documents: z.record(z.string(), z.object({ readOn: z.string().optional(), annotations: z.array(z.object({ id: z.string(), text: z.string(), block: z.number().int().optional(), createdOn: z.string() })), evidence: z.boolean() })),
  ticks: z.record(z.string(), z.string()),
  tickMarks: z.array(z.object({ id: z.string(), symbol: z.string(), label: z.string(), tone })),
  savedQueries: z.array(z.object({ id: z.string(), name: z.string(), query: querySchema, createdOn: z.string() })),
  journal: z.array(z.object({ on: z.string(), kind: z.enum(['documentRead', 'evidence', 'annotation', 'query', 'tick', 'setting']), detail: z.string() })),
  seq: z.number().int().min(0),
});

/** Migrations from older schema versions (none yet: version 1 is the first saved format). */
const MIGRATIONS: Record<number, (raw: Record<string, unknown>) => Record<string, unknown>> = {};

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

export type LoadResult = { ok: true; state: GameState } | { ok: false; reason: string };

export function deserialize(text: string, scenarioId: string): LoadResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'sauvegarde illisible' };
  }
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'sauvegarde illisible' };
  let obj = raw as Record<string, unknown>;
  let version = typeof obj['schemaVersion'] === 'number' ? (obj['schemaVersion'] as number) : 0;
  while (version < SCHEMA_VERSION) {
    const m = MIGRATIONS[version];
    if (!m) return { ok: false, reason: `version de sauvegarde ${version} non prise en charge` };
    obj = m(obj);
    version = obj['schemaVersion'] as number;
  }
  const parsed = stateSchema.safeParse(obj);
  if (!parsed.success) return { ok: false, reason: 'sauvegarde invalide' };
  if (parsed.data.scenarioId !== scenarioId) return { ok: false, reason: 'sauvegarde d’un autre dossier' };
  const state = parsed.data as GameState;
  return { ok: true, state: { ...state, savedQueries: state.savedQueries.map((q) => ({ ...q, query: { ...EMPTY_QUERY, ...q.query } })) } };
}
