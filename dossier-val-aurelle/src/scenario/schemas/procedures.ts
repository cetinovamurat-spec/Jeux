/** Schema of params/procedures.json (owned by J4b). */
import { z } from 'zod';

export const proceduresParamsSchema = z.object({
  procedures: z.array(z.object({ id: z.string(), cycle: z.string(), title: z.string() }).passthrough()),
  firmProgramme2024: z.array(z.object({ procedureId: z.string(), assignee: z.string() })),
});
export type ProceduresParams = z.infer<typeof proceduresParamsSchema>;
