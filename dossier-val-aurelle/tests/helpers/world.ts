import { generateWorld, type GenerationResult } from '../../src/scenario/generator';
import { loadParams, type Params } from '../../src/scenario/params';

let cached: GenerationResult | null = null;

/** One generation per test file (deterministic). */
export function world(): GenerationResult {
  cached ??= generateWorld();
  return cached;
}

export function params(): Params {
  return loadParams();
}
