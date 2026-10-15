/**
 * Findings (plan J4 §13.1): structured, created in context; impacts are
 * derived from the proposed entry; matching to the key is computed, never
 * stored. Section of the game state owned by J4d.
 */
import { z } from 'zod';
import type { IsoDate } from '../engine/dates';

/** Typed evidence: never the internal id of an entry (it can name an anomaly). */
export type Evidence =
  | { kind: 'doc'; docId: string; block?: number }
  | { kind: 'fec'; year: number; num: string }
  | { kind: 'sample' | 'recalc' | 'query' | 'execution' | 'confirmation'; id: string };

export interface ProposedLine {
  account: string;
  debit: number;
  credit: number;
  aux?: string;
}

export interface Finding {
  id: string;
  cycle: string;
  objects: { kind: string; id: string }[];
  natures: string[];
  classification: 'factual' | 'judgemental' | 'projected';
  treatments: string[];
  proposedEntry: ProposedLine[];
  /** Expected disclosure fix chosen from the list (disclosure treatments without an entry). */
  disclosureFix: string | null;
  evidence: Evidence[];
  status: 'question' | 'finding' | 'dismissed' | 'closed';
  history: { on: IsoDate; status: Finding['status'] }[];
  escalatedToPartnerOn: IsoDate | null;
  comment: string;
  createdOn: IsoDate;
}

export interface FindingsState {
  items: Finding[];
}

export function initialFindings(): FindingsState {
  return { items: [] };
}

const status = z.enum(['question', 'finding', 'dismissed', 'closed']);
const evidence = z.union([
  z.object({ kind: z.literal('doc'), docId: z.string(), block: z.number().int().optional() }),
  z.object({ kind: z.literal('fec'), year: z.number().int(), num: z.string() }),
  z.object({ kind: z.enum(['sample', 'recalc', 'query', 'execution', 'confirmation']), id: z.string() }),
]);
export const findingsSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      cycle: z.string(),
      objects: z.array(z.object({ kind: z.string(), id: z.string() })),
      natures: z.array(z.string()),
      classification: z.enum(['factual', 'judgemental', 'projected']),
      treatments: z.array(z.string()),
      proposedEntry: z.array(z.object({ account: z.string(), debit: z.number().int(), credit: z.number().int(), aux: z.string().optional() })),
      disclosureFix: z.string().nullable(),
      evidence: z.array(evidence),
      status,
      history: z.array(z.object({ on: z.string(), status })),
      escalatedToPartnerOn: z.string().nullable(),
      comment: z.string(),
      createdOn: z.string(),
    }),
  ),
});
