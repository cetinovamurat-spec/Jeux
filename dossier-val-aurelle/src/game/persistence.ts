/**
 * Save format: the game state only (the scenario is regenerated), with a
 * schema version and migrations. Pure functions; the UI handles storage.
 */
import { z } from 'zod';
import { EMPTY_QUERY } from './fec-query';
import { confirmationsSchema } from './confirmations';
import { findingsSchema } from './findings';
import { gaugesSchema } from './gauges';
import { planningSchema } from './planning';
import { programSchema } from './program';
import { recalcsSchema } from './recalcs';
import { requestsSchema } from './requests';
import { samplesSchema } from './samples';
import { SCHEMA_VERSION, type GameState } from './state';
import { worksheetsSchema } from './worksheets';

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

const settingsSchema = z.object({ theme: z.enum(['system', 'light', 'dark']), designer: z.boolean() });
const tickMarksSchema = z.array(z.object({ id: z.string(), symbol: z.string(), label: z.string(), tone }));
const savedQueriesSchema = z.array(z.object({ id: z.string(), name: z.string(), query: querySchema, createdOn: z.string() }));

const stateSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  scenarioId: z.string(),
  scenarioHash: z.string(),
  contentVersion: z.number().int(),
  difficulty: z.enum(['assistant', 'senior', 'manager']),
  clock: z.object({ date: z.string(), processedUntil: z.string() }),
  settings: settingsSchema,
  documents: z.record(z.string(), z.object({ readOn: z.string().optional(), annotations: z.array(z.object({ id: z.string(), text: z.string(), block: z.number().int().optional(), createdOn: z.string() })), evidence: z.boolean() })),
  ticks: z.record(z.string(), z.string()),
  tickMarks: tickMarksSchema,
  savedQueries: savedQueriesSchema,
  journal: z.array(z.object({ on: z.string(), kind: z.string(), ref: z.string().optional(), data: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional() })),
  seq: z.number().int().min(0),
  planning: planningSchema,
  program: programSchema,
  worksheets: worksheetsSchema,
  requests: requestsSchema,
  confirmations: confirmationsSchema,
  samples: samplesSchema,
  recalcs: recalcsSchema,
  findings: findingsSchema,
  gauges: gaugesSchema,
});

/**
 * Migrations from older schema versions, applied in sequence. Each receives
 * the raw object and a fresh state of the current version.
 *
 * 1 → 2 (J3 → J4): a J3 game is fixed at 23/02/2026, without planning, and its
 * confirmations can no longer be sent: the game restarts at the beginning of
 * the engagement, keeping the settings, the custom tick marks and the saved
 * FEC queries (the ids counter is kept so that no id is reused).
 */
const MIGRATIONS: Record<number, (raw: Record<string, unknown>, fresh: GameState) => Record<string, unknown>> = {
  1: (raw, fresh) => {
    const keep = <T>(schema: z.ZodType<T>, v: unknown, fallback: T): T => {
      const r = schema.safeParse(v);
      return r.success ? r.data : fallback;
    };
    return {
      ...fresh,
      settings: keep(settingsSchema, raw['settings'], fresh.settings),
      tickMarks: keep(tickMarksSchema, raw['tickMarks'], fresh.tickMarks),
      savedQueries: keep(savedQueriesSchema, raw['savedQueries'], fresh.savedQueries),
      seq: typeof raw['seq'] === 'number' ? raw['seq'] : fresh.seq,
    };
  },
};

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

export type LoadResult =
  | {
      ok: true;
      state: GameState;
      /** Schema version the save was migrated from (the player is told when the game restarted). */
      migratedFrom?: number;
      /** The save was made with another generated world or another content version: references may be orphaned. */
      contentChanged?: boolean;
    }
  | { ok: false; reason: string };

/** Reads a save; `fresh` is a new game of the current version (migrations start from it). */
export function deserialize(text: string, fresh: GameState): LoadResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'sauvegarde illisible' };
  }
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'sauvegarde illisible' };
  let obj = raw as Record<string, unknown>;
  if (typeof obj['scenarioId'] === 'string' && obj['scenarioId'] !== fresh.scenarioId) return { ok: false, reason: 'sauvegarde d’un autre dossier' };
  const from = typeof obj['schemaVersion'] === 'number' ? (obj['schemaVersion'] as number) : 0;
  let version = from;
  while (version < SCHEMA_VERSION) {
    const m = MIGRATIONS[version];
    if (!m) return { ok: false, reason: `version de sauvegarde ${version} non prise en charge` };
    obj = m(obj, fresh);
    version = obj['schemaVersion'] as number;
  }
  if (version > SCHEMA_VERSION) return { ok: false, reason: `version de sauvegarde ${version} plus récente que le jeu` };
  const parsed = stateSchema.safeParse(obj);
  if (!parsed.success) return { ok: false, reason: 'sauvegarde invalide' };
  const state = parsed.data as GameState;
  const contentChanged = state.scenarioHash !== fresh.scenarioHash || state.contentVersion !== fresh.contentVersion;
  return {
    ok: true,
    state: { ...state, savedQueries: state.savedQueries.map((q) => ({ ...q, query: { ...EMPTY_QUERY, ...q.query } })) },
    ...(from < SCHEMA_VERSION ? { migratedFrom: from } : {}),
    ...(contentChanged ? { contentChanged } : {}),
  };
}
