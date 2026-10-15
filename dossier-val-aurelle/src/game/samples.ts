/**
 * Samples (plan J4 §10): population, method, seed, parameters and the keys of
 * the items drawn (frozen at the draw). Results per item use the ticking of
 * J3 (keys 'sample:<id>:<item>'). Section of the game state owned by J4c.
 */
import { z } from 'zod';
import type { HoursCharge } from './budget';
import type { IsoDate } from '../engine/dates';
import type { Params } from '../scenario/params';

export interface Sample {
  id: string;
  executionId: string | null;
  population: string;
  method: 'specific' | 'random' | 'systematic' | 'stratified' | 'monetaryUnit';
  seed: string;
  parameters: Record<string, number | string | boolean>;
  items: string[];
  drawnOn: IsoDate;
}

export interface SamplesState {
  items: Sample[];
}

export function initialSamples(): SamplesState {
  return { items: [] };
}

export const samplesSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      executionId: z.string().nullable(),
      population: z.string(),
      method: z.enum(['specific', 'random', 'systematic', 'stratified', 'monetaryUnit']),
      seed: z.string(),
      parameters: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])),
      items: z.array(z.string()),
      drawnOn: z.string(),
    }),
  ),
});

/** Hours charged to the budget by the draws and redraws of samples. */
export function hoursCharged(_s: SamplesState, _params: Params): HoursCharge[] {
  return [];
}
