/**
 * Tool opened by a procedure of the programme (owned by J4c): sample,
 * recalculation, document requests or confirmations, according to the
 * output of the procedure (params/procedures.json → output).
 */
export interface ToolOutput {
  kind: string;
  [key: string]: unknown;
}

export function ToolForOutput({ executionId, output }: { executionId: string; output: ToolOutput }) {
  return (
    <p className="text-sm text-muted" data-execution={executionId}>
      Outil « {output.kind} » en cours de réalisation.
    </p>
  );
}
