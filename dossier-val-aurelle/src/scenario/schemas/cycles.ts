/**
 * Schema of params/cycles.json (owned by J4b): audit cycles (the eight Cycle
 * ids of scenario/anomalies/types.ts), with the groups of accounts shown on
 * their master worksheet and used for the significant accounts, and the
 * statement lines they cover.
 */
import { z } from 'zod';
import { CYCLE_IDS } from './procedures';

export const cycleLineSchema = z.object({
  id: z.string(),
  label: z.string(),
  include: z.array(z.string()).min(1),
  exclude: z.array(z.string()).optional(),
  /** Sign of the amount shown: debit balances positive (assets, charges) or credit balances positive (liabilities, products). */
  sign: z.enum(['debit', 'credit']),
});

export const cyclesParamsSchema = z
  .object({
    cycles: z.array(
      z.object({
        id: z.enum(CYCLE_IDS),
        label: z.string(),
        description: z.string(),
        lines: z.array(cycleLineSchema),
        statementLines: z.array(z.string()),
      }),
    ),
    /** Conclusions of a master worksheet. */
    conclusions: z.array(z.object({ id: z.string(), label: z.string(), tone: z.enum(['ok', 'ko', 'accent', 'warn', 'muted']) })),
  })
  .superRefine((p, ctx) => {
    const seen = new Set(p.cycles.map((c) => c.id));
    for (const id of CYCLE_IDS) if (!seen.has(id)) ctx.addIssue({ code: 'custom', message: `cycle absent : ${id}` });
  });
export type CyclesParams = z.infer<typeof cyclesParamsSchema>;
export type CycleDef = CyclesParams['cycles'][number];
