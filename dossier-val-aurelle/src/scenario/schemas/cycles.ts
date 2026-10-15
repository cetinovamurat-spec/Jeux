/** Schema of params/cycles.json (owned by J4b). */
import { z } from 'zod';

export const cyclesParamsSchema = z.object({
  cycles: z.array(z.object({ id: z.string(), label: z.string() }).passthrough()),
});
export type CyclesParams = z.infer<typeof cyclesParamsSchema>;
