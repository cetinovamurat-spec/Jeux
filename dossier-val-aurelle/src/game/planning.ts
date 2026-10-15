/**
 * Planning (§10.1 steps 3-5, plan J4 §6): materiality, risk assessment,
 * fraud presumption, laws and regulations. Section of the game state owned by
 * J4b: types, initial value, save schema and pure actions.
 */
import { z } from 'zod';
import type { IsoDate } from '../engine/dates';

export interface MaterialityChoice {
  /** Base of the materiality (params/planning.json → bases). */
  base: string;
  /** Data vintage of the base amount ('certified2024', 'interim', 'draft2025'). */
  vintage: string;
  pct: number;
  planningPct: number;
  trivialPct: number;
  /** Specific threshold for the regulated agreements, in % of the materiality (optional). */
  specificPct: number | null;
  factors: string[];
  comment: string;
  on: IsoDate;
}

export interface RiskEntry {
  level: 'low' | 'moderate' | 'high' | 'significant';
  justification: string;
  on: IsoDate;
}

/** Risk factor captured by the player from a passage of a document (block of the GED). */
export interface RiskFactor {
  id: string;
  docId: string;
  block: number | null;
  cycle: string;
  assertion: string | null;
  note: string;
  on: IsoDate;
}

export interface PlanningState {
  /** Validated materiality choices, oldest first (the last one is in force). */
  materiality: MaterialityChoice[];
  /** Risk by 'cycle' or 'cycle:assertion'. */
  risks: Record<string, RiskEntry>;
  riskFactors: RiskFactor[];
  /** Fraud presumption by type of revenue: retained or rebutted (with a justification). */
  fraudPresumption: Record<string, { retained: boolean; justification: string }>;
  /** Steps validated by the player (desk checklist, « Aller à l'intérim »). */
  validated: { materiality?: IsoDate; risks?: IsoDate; program?: IsoDate };
}

export function initialPlanning(): PlanningState {
  return { materiality: [], risks: {}, riskFactors: [], fraudPresumption: {}, validated: {} };
}

const riskEntry = z.object({ level: z.enum(['low', 'moderate', 'high', 'significant']), justification: z.string(), on: z.string() });
export const planningSchema = z.object({
  materiality: z.array(
    z.object({
      base: z.string(),
      vintage: z.string(),
      pct: z.number(),
      planningPct: z.number(),
      trivialPct: z.number(),
      specificPct: z.number().nullable(),
      factors: z.array(z.string()),
      comment: z.string(),
      on: z.string(),
    }),
  ),
  risks: z.record(z.string(), riskEntry),
  riskFactors: z.array(z.object({ id: z.string(), docId: z.string(), block: z.number().int().nullable(), cycle: z.string(), assertion: z.string().nullable(), note: z.string(), on: z.string() })),
  fraudPresumption: z.record(z.string(), z.object({ retained: z.boolean(), justification: z.string() })),
  validated: z.object({ materiality: z.string().optional(), risks: z.string().optional(), program: z.string().optional() }),
});

/** Adds a risk factor captured from a document passage (id given by the caller, from the state counter). */
export function addRiskFactor(p: PlanningState, f: RiskFactor): PlanningState {
  return { ...p, riskFactors: [...p.riskFactors, f] };
}

export function removeRiskFactor(p: PlanningState, id: string): PlanningState {
  return { ...p, riskFactors: p.riskFactors.filter((f) => f.id !== id) };
}
