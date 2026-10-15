/** Schema of params/disclosure-items.json (owned by J4d). */
import { z } from 'zod';

export const disclosureItemsParamsSchema = z.object({
  items: z.array(z.object({ id: z.string(), label: z.string() }).passthrough()),
});
export type DisclosureItemsParams = z.infer<typeof disclosureItemsParamsSchema>;
