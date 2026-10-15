/** Schema of params/requests.json (owned by J4c). */
import { z } from 'zod';

export const requestsParamsSchema = z.object({
  families: z.array(z.object({ id: z.string(), label: z.string() }).passthrough()),
});
export type RequestsParams = z.infer<typeof requestsParamsSchema>;
