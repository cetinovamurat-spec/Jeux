/**
 * Schema of params/planning.json (owned by J4b): materiality bases and
 * ranges (§4.7, NEP 320), justification factors, revenue types of the fraud
 * presumption (NEP 240), laws and regulations (NEP 250), risk levels and the
 * reference risk matrix read by J6.
 */
import { z } from 'zod';
import { ASSERTION_IDS, CYCLE_IDS } from './procedures';

const range = z.tuple([z.number().nonnegative(), z.number().positive()]).refine(([a, b]) => a <= b, 'plage inversée');
const prefixRule = z.object({ include: z.array(z.string()).min(1), exclude: z.array(z.string()).optional() });

export const RISK_LEVELS = ['low', 'moderate', 'high', 'significant'] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const MATERIALITY_VINTAGES = ['certified2024', 'interim', 'draft2025'] as const;
export type MaterialityVintage = (typeof MATERIALITY_VINTAGES)[number];

export const baseSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    /** Amount of the base: credit balance of account prefixes (flows), or a line of the statements (stocks and result). */
    accounts: prefixRule.optional(),
    statementLine: z.string().optional(),
    /** Income-statement flow: annualised on a partial-year extraction. */
    flow: z.boolean(),
    /** Range of percentages usually applied to this base. */
    pctRange: range,
    defaultPct: z.number().positive(),
    /** Suitability of the base for this entity (pedagogical feedback of §4.7). */
    suitability: z.enum(['recommended', 'acceptable', 'unsuitable', 'unstable']),
    feedback: z.string(),
  })
  .refine((b) => (b.accounts ? 1 : 0) + (b.statementLine ? 1 : 0) === 1, 'une base se calcule par comptes ou par ligne d’états');

export const planningParamsSchema = z.object({
  bases: z.array(baseSchema).min(1),
  vintages: z.record(z.enum(MATERIALITY_VINTAGES), z.object({ label: z.string() })),
  thresholds: z.object({
    planningPctRange: range,
    trivialPctRange: range,
    specificPctRange: range,
    defaultPlanningPct: z.number().positive(),
    defaultTrivialPct: z.number().positive(),
    /** Rounding units offered for the materiality (euros; 0 = none). */
    roundingEuros: z.array(z.number().nonnegative()).min(1),
  }),
  /** Reference answer of §4.7 (read by J6, never shown before the debrief). */
  reference: z.object({ base: z.string(), vintage: z.enum(MATERIALITY_VINTAGES), pct: z.number().positive(), pctRange: range, planningPct: z.number().positive(), trivialPct: z.number().positive() }),
  factors: z.array(z.object({ id: z.string(), label: z.string() })),
  riskLevels: z.array(z.object({ id: z.enum(RISK_LEVELS), label: z.string(), needsJustification: z.boolean() })).length(RISK_LEVELS.length),
  assertions: z.array(z.object({ id: z.enum(ASSERTION_IDS), label: z.string() })),
  revenueTypes: z.array(z.object({ id: z.string(), label: z.string(), description: z.string(), reference: z.enum(['rebuttable', 'retained']) })),
  lawsRegulations: z.array(z.object({ id: z.string(), label: z.string(), description: z.string() })),
  /** Mandatory responses to the risk of management override (always retained). */
  overrideResponses: z.array(z.string()).min(1),
  /** Reference risk matrix at the cycle level (read by J6). */
  referenceRisks: z.record(z.enum(CYCLE_IDS), z.enum(RISK_LEVELS)),
});
export type PlanningParams = z.infer<typeof planningParamsSchema>;
export type PlanningBase = z.infer<typeof baseSchema>;
