/**
 * Schema of params/disclosure-items.json (owned by J4d): catalogue of the
 * findings form — items of the annex and of the management report (objects
 * « disclosureItem »), disclosure fixes offered when the treatment has no
 * entry, and the parameters of the matching to the key (default tolerance,
 * range of projected misstatements, limits of the form).
 */
import { z } from 'zod';

export const FINDING_TREATMENT_IDS = ['adjust', 'reclassify', 'disclose', 'report', 'specialReport', 'governance', 'internalControl'] as const;

export const disclosureItemsParamsSchema = z
  .object({
    items: z.array(z.object({ id: z.string(), label: z.string(), document: z.enum(['annex', 'report']) })).min(1),
    fixes: z.array(z.object({ id: z.string(), label: z.string(), treatments: z.array(z.enum(FINDING_TREATMENT_IDS)).min(1) })).min(1),
    matching: z.object({
      toVerify: z.boolean().optional(),
      /** Default tolerance on the measure of a part, in % (the reference clearly-trivial threshold applies when larger). */
      tolerancePct: z.number().positive(),
      /** Range accepted for a projected misstatement (sample), as shares of the measure of the part. */
      projectedShareRange: z.tuple([z.number().positive(), z.number().positive()]),
      maxObjects: z.number().int().positive(),
      maxNatures: z.number().int().positive(),
    }),
  })
  .superRefine((p, ctx) => {
    const dup = (ids: string[], what: string) => {
      const seen = new Set<string>();
      for (const id of ids) {
        if (seen.has(id)) ctx.addIssue({ code: 'custom', message: `${what} en double : ${id}` });
        seen.add(id);
      }
    };
    dup(p.items.map((i) => i.id), 'information');
    dup(p.fixes.map((f) => f.id), 'correction');
    const [lo, hi] = p.matching.projectedShareRange;
    if (lo > 1 || hi < 1) ctx.addIssue({ code: 'custom', message: 'la plage des anomalies extrapolées doit contenir 1' });
  });
export type DisclosureItemsParams = z.infer<typeof disclosureItemsParamsSchema>;
