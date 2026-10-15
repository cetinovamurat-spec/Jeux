/** Schema of params/sampling.json (owned by J4c). */
import { z } from 'zod';

export const samplingParamsSchema = z.object({
  confidenceFactors: z.record(z.string(), z.number()),
  controlSampleSizes: z.array(z.object({ frequency: z.string(), size: z.number().int() }).passthrough()),
});
export type SamplingParams = z.infer<typeof samplingParamsSchema>;
