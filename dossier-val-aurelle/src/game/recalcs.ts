/**
 * Recalculations (plan J4 §11): tool, scope, assumptions with their source,
 * and a summary (computed, recorded, gap) — never the detailed lines.
 * Section of the game state owned by J4c.
 */
import { z } from 'zod';
import type { IsoDate } from '../engine/dates';

export interface Recalc {
  id: string;
  executionId: string | null;
  tool: string;
  scope: string;
  assumptions: Record<string, { value: string | number; source: string | null }>;
  summary: { computed: number; recorded: number };
  on: IsoDate;
}

export interface RecalcsState {
  items: Recalc[];
}

export function initialRecalcs(): RecalcsState {
  return { items: [] };
}

export const recalcsSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      executionId: z.string().nullable(),
      tool: z.string(),
      scope: z.string(),
      assumptions: z.record(z.string(), z.object({ value: z.union([z.string(), z.number()]), source: z.string().nullable() })),
      summary: z.object({ computed: z.number(), recorded: z.number() }),
      on: z.string(),
    }),
  ),
});
