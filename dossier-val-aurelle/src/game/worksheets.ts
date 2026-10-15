/**
 * Master worksheets by cycle (plan J4 §12): conclusion, comment, explained
 * variations and pinned references; N, N-1, variation and the references to
 * the work are derived. Section of the game state owned by J4b.
 */
import { z } from 'zod';
import type { IsoDate } from '../engine/dates';

export interface MasterSheet {
  conclusion: string | null;
  comment: string;
  /** Variations explained by the player (statement line or account → explanation and evidence). */
  explained: Record<string, { text: string; evidence: string[] }>;
  pins: string[];
  on?: IsoDate;
}

export interface WorksheetsState {
  master: Record<string, MasterSheet>;
}

export function initialWorksheets(): WorksheetsState {
  return { master: {} };
}

export const worksheetsSchema = z.object({
  master: z.record(
    z.string(),
    z.object({
      conclusion: z.string().nullable(),
      comment: z.string(),
      explained: z.record(z.string(), z.object({ text: z.string(), evidence: z.array(z.string()) })),
      pins: z.array(z.string()),
      on: z.string().optional(),
    }),
  ),
});
