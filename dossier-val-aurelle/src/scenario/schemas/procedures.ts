/**
 * Schema of params/procedures.json (owned by J4b): the procedure library
 * (§10.3, plan J4 §7) and the firm's 2024 programme proposed by the manager.
 *
 * The ids shared with the other lots (request families, sample populations,
 * recalculation tools, screens) are listed here as enumerations: a procedure
 * cannot reference an id outside the contract between the lots.
 */
import { z } from 'zod';
import type { Cycle, Nature } from '../anomalies/types';

export const CYCLE_IDS = ['crossCycle', 'rentReceivables', 'fixedAssets', 'provisions', 'debtTreasury', 'purchases', 'equitySubsidies', 'disclosures'] as const satisfies readonly Cycle[];
export const ASSERTION_IDS = ['occurrence', 'completeness', 'cutoff', 'valuation', 'classification', 'presentation', 'compliance'] as const satisfies readonly Nature[];

/** Calendar periods (game.json → calendar) in which a procedure can be launched. */
export const PHASE_IDS = ['planning', 'interim', 'final', 'completion', 'reporting'] as const;
export type PhaseId = (typeof PHASE_IDS)[number];

/** Staff profiles: senior (the player), assistant (Léa), intern (Hugo), IT auditor (Sofia). */
export const PROFILE_IDS = ['senior', 'assistant', 'intern', 'itAuditor'] as const;
export type ProfileId = (typeof PROFILE_IDS)[number];

// --- contract between the lots (plan J4, lots B, C and D) -----------------------
export const REQUEST_FAMILIES = [
  'interim-extraction',
  'entry-voucher',
  'programme-invoices',
  'programme-rent-roll',
  'operation-orders',
  'operation-acceptance',
  'supplier-tender',
  'sale-notary',
  'third-party-agreements',
  'programme-components',
  'bank-statements',
  'closing-file',
] as const;
/** Objects of the 'closing-file' family (one per type of closing document). */
export const CLOSING_FILES = ['icne', 'pge', 'impairment', 'aged-balance', 'debt-schedule', 'subsidies', 'management-report-support', 'migration', 'governance-register'] as const;
export const SAMPLE_POPULATIONS = ['capitalised-works', 'construction-progress', 'maintenance-charges', 'invoices-2026', 'rent-roll', 'tenant-receivables', 'loans'] as const;
export const RECALC_TOOLS = ['depreciation', 'icne', 'impairment', 'pge', 'rent-revision', 'prorata'] as const;
export const VIEW_SCREENS = ['/fec', '/etats', '/ged', '/analyse', '/balance', '/grand-livre'] as const;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// --- conditions (game/conditions.ts evaluates them) -------------------------------
export type Condition =
  | { kind: 'vintage'; vintage: 'interim' | 'draftLedger' | 'draftStatements' }
  | { kind: 'dateFrom'; date: string }
  | { kind: 'period'; ids: string[] }
  | { kind: 'document'; docId: string }
  | { kind: 'request'; family: string; object?: string }
  | { kind: 'procedure'; procedureId: string; state: 'launched' | 'delivered' | 'documented' }
  | { kind: 'all' | 'any'; of: Condition[] }
  | { kind: 'not'; of: Condition };

export const conditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z.object({ kind: z.literal('vintage'), vintage: z.enum(['interim', 'draftLedger', 'draftStatements']) }),
    z.object({ kind: z.literal('dateFrom'), date: isoDate }),
    z.object({ kind: z.literal('period'), ids: z.array(z.string()).min(1) }),
    z.object({ kind: z.literal('document'), docId: z.string() }),
    z.object({ kind: z.literal('request'), family: z.enum(REQUEST_FAMILIES), object: z.string().optional() }),
    z.object({ kind: z.literal('procedure'), procedureId: z.string(), state: z.enum(['launched', 'delivered', 'documented']) }),
    z.object({ kind: z.enum(['all', 'any']), of: z.array(conditionSchema) }),
    z.object({ kind: z.literal('not'), of: conditionSchema }),
  ]),
);

// --- typed outputs (plan J4 §7.2) --------------------------------------------------
export const requestRefSchema = z.object({ family: z.enum(REQUEST_FAMILIES), object: z.string().optional() });
export const outputSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('view'), screen: z.enum(VIEW_SCREENS) }),
  z.object({ kind: z.literal('requests'), requests: z.array(requestRefSchema).min(1) }),
  z.object({ kind: z.literal('confirmations') }),
  z.object({ kind: z.literal('sample'), population: z.enum(SAMPLE_POPULATIONS) }),
  z.object({ kind: z.literal('recalc'), tool: z.enum(RECALC_TOOLS) }),
  z.object({ kind: z.literal('memo'), memo: z.string() }),
]);
export type ProcedureOutput = z.infer<typeof outputSchema>;

// --- completion criteria (plan J4 §7.3): the procedure is true, not a ticked box --------
export const QUERY_CRITERIA = ['validatedAfterClosing', 'users', 'roundMultiple', 'rarePairsMax', 'weekend', 'missingPiece', 'keywords'] as const;
export const completionSchema = z.discriminatedUnion('kind', [
  /** Saved FEC queries covering at least `min` of the usual criteria. */
  z.object({ kind: z.literal('queries'), criteria: z.array(z.enum(QUERY_CRITERIA)).min(1), min: z.number().int().positive() }),
  /** Share of tickable cells ticked: N-1 column of the statements, statements, annex (optionally one table). */
  z.object({ kind: z.literal('ticks'), scope: z.enum(['comparative', 'statements', 'annex']), table: z.string().optional(), minPct: z.number().min(0).max(100) }),
  /** A sample drawn within the execution, every item marked. */
  z.object({ kind: z.literal('sample') }),
  /** A recalculation run within the execution. */
  z.object({ kind: z.literal('recalc') }),
  /** The documents requested by the output answered. */
  z.object({ kind: z.literal('requests') }),
  /** At least `min` confirmation requests prepared. */
  z.object({ kind: z.literal('confirmations'), min: z.number().int().positive() }),
  /** Share of the available documents of a category read. */
  z.object({ kind: z.literal('read'), category: z.enum(['permanent', 'governance', 'accounting', 'contracts', 'mail', 'internal', 'thirdParty']), minPct: z.number().min(0).max(100) }),
  /** The worksheet was updated on or after the start of a calendar period (subsequent events: update at the signature). */
  z.object({ kind: z.literal('updated'), fromPeriod: z.string() }),
]);
export type CompletionCriterion = z.infer<typeof completionSchema>;

const hoursSchema = z
  .object({ senior: z.number().positive().optional(), assistant: z.number().positive().optional(), intern: z.number().positive().optional(), itAuditor: z.number().positive().optional() })
  .refine((h) => Object.values(h).some((v) => v !== undefined), 'au moins un profil');

/** Diligences required by the standards (§10.8) and the engagement acceptance. */
export const MANDATORY_IDS = ['acceptance', 'journalEntryTests', 'comparative', 'subsequentEvents', 'representationLetter'] as const;

export const procedureSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  cycle: z.enum(CYCLE_IDS),
  title: z.string(),
  objective: z.string(),
  /** Work steps shown on the worksheet (method, never a lead). */
  steps: z.array(z.string()).min(1),
  assertions: z.array(z.enum(ASSERTION_IDS)),
  /** Risks the procedure answers: cycle, 'cycle:assertion', 'fraud:<revenue type>', 'override', 'laws:<id>'. */
  risksAddressed: z.array(z.string()).min(1),
  hours: hoursSchema,
  phases: z.array(z.enum(PHASE_IDS)).min(1),
  requires: z.array(conditionSchema).default([]),
  mandatory: z.enum(MANDATORY_IDS).optional(),
  /** Response to the risk of management override (always retained): added to the programme automatically. */
  overrideResponse: z.boolean().optional(),
  output: outputSchema,
  completion: z.array(completionSchema).default([]),
  /**
   * Anomaly parts the procedure can reveal (debrief and tests only, never
   * shown to the player outside the designer mode).
   */
  effectiveFor: z.array(z.string()).default([]),
  /** Delegated work (§7): the scripted faulty variant of J5 (T1 to T4) and the member it concerns. Correct in J4. */
  delegated: z.object({ variant: z.enum(['T1', 'T2', 'T3', 'T4']), member: z.enum(['lea', 'hugo']) }).optional(),
});
export type ProcedureDef = z.infer<typeof procedureSchema>;

const member = z.enum(['senior', 'lea', 'hugo', 'sofia']);

export const proceduresParamsSchema = z
  .object({
    procedures: z.array(procedureSchema),
    /** Conclusions of a worksheet (list chosen by the player). */
    conclusions: z.array(z.object({ id: z.string(), label: z.string(), tone: z.enum(['ok', 'ko', 'accent', 'warn', 'muted']) })),
    /** Profile of each member of the team (game.json → team). */
    profiles: z.record(member, z.enum(PROFILE_IDS)),
    firmProgramme2024: z.array(z.object({ procedureId: z.string(), assignee: member })),
  })
  .superRefine((p, ctx) => {
    const ids = new Set<string>();
    for (const x of p.procedures) {
      if (ids.has(x.id)) ctx.addIssue({ code: 'custom', message: `procédure en double : ${x.id}` });
      ids.add(x.id);
    }
    for (const f of p.firmProgramme2024) if (!ids.has(f.procedureId)) ctx.addIssue({ code: 'custom', message: `programme du cabinet : procédure inconnue ${f.procedureId}` });
  });
export type ProceduresParams = z.infer<typeof proceduresParamsSchema>;
