/**
 * Schema of params/sampling.json (owned by J4c): sample sizes of the tests of
 * details (confidence factors by assessed risk, reliance on controls,
 * expected misstatement), sizes of the tests of controls by frequency, costs
 * and the reference samples of the integrity tests (plan J4 §10).
 */
import { z } from 'zod';

export const RISK_LEVELS = ['low', 'moderate', 'high', 'significant'] as const;
export const CONTROL_RELIANCE = ['effective', 'notTested', 'deficient'] as const;
export const SAMPLE_METHODS = ['specific', 'random', 'systematic', 'stratified', 'monetaryUnit'] as const;

export const samplingParamsSchema = z.object({
  /** Confidence factor by assessed risk of material misstatement of the cycle. */
  confidenceFactors: z.record(z.string(), z.number()),
  /** Multiplier of the confidence factor according to the controls tested at the interim. */
  controlReliance: z.record(z.string(), z.number().positive()),
  /** Expected misstatement, as a share of the tolerable misstatement (planning materiality). */
  expectedMisstatementShare: z.number().min(0).max(0.9),
  /** Expansion factor applied to the expected misstatement. */
  expansionFactor: z.number().min(1),
  minSize: z.number().int().positive(),
  maxSize: z.number().int().positive(),
  /** Number of strata of a stratified draw (equal value per stratum). */
  strata: z.number().int().min(2),
  /** Tests of controls: number of occurrences to test by frequency of the control. */
  controlSampleSizes: z.array(z.object({ frequency: z.string(), label: z.string().optional(), size: z.number().int() })),
  /** Hours of a draw outside a procedure and of every new draw (new seed). */
  drawHours: z.number().min(0),
  redrawHours: z.number().min(0),
  /** Hours of a recalculation run outside a procedure (within a procedure, its hours are those of the procedure). */
  recalcHours: z.number().min(0),
  /** Reference samples (integrity tests, reference programme). */
  reference: z.record(
    z.string(),
    z.object({ population: z.string(), method: z.enum(SAMPLE_METHODS), risk: z.enum(RISK_LEVELS), controls: z.enum(CONTROL_RELIANCE) }),
  ),
  /** Selection rule of the delegated test of acquisitions (T2): acquisitions above this amount only (euros). */
  delegatedAcquisitionsThresholdEuros: z.number().positive(),
});
export type SamplingParams = z.infer<typeof samplingParamsSchema>;
