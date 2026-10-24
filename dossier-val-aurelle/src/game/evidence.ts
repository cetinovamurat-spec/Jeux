/**
 * Typed evidence (plan J4 §13.1): what a finding links and what a session of
 * the interviews presents (plan J5 §6.1). Leaf module (type and save schema),
 * imported by findings.ts and interviews.ts.
 */
import { z } from 'zod';

/** Typed evidence: never the internal id of an entry (it can name an anomaly). */
export type Evidence =
  | { kind: 'doc'; docId: string; block?: number }
  | { kind: 'fec'; year: number; num: string }
  | { kind: 'sample' | 'recalc' | 'query' | 'execution' | 'confirmation'; id: string };

export const evidenceSchema = z.union([
  z.object({ kind: z.literal('doc'), docId: z.string(), block: z.number().int().optional() }),
  z.object({ kind: z.literal('fec'), year: z.number().int(), num: z.string() }),
  z.object({ kind: z.enum(['sample', 'recalc', 'query', 'execution', 'confirmation']), id: z.string() }),
]);
