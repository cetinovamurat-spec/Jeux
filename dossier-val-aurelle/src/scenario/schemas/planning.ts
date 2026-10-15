/** Schema of params/planning.json (owned by J4b). */
import { z } from 'zod';

export const planningParamsSchema = z.object({
  bases: z.array(z.object({ id: z.string(), label: z.string() }).passthrough()),
  factors: z.array(z.object({ id: z.string(), label: z.string() }).passthrough()),
  revenueTypes: z.array(z.object({ id: z.string(), label: z.string() }).passthrough()),
  lawsRegulations: z.array(z.object({ id: z.string(), label: z.string() }).passthrough()),
});
export type PlanningParams = z.infer<typeof planningParamsSchema>;
