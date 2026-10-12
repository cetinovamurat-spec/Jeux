import { buildCorrectionKey, type CorrectionKey } from '../../src/scenario/anomalies/presented';
import { buildSynthesis, type Synthesis } from '../../src/scenario/anomalies/synthesis';
import { buildDocuments, type DocumentSet } from '../../src/scenario/documents';
import { params, world } from './world';

let key: CorrectionKey | null = null;
let docs: DocumentSet | null = null;
let syn: Synthesis | null = null;

/** Presented world and correction key (one computation per test file). */
export function correctionKey(): CorrectionKey {
  key ??= buildCorrectionKey(world().world, params());
  return key;
}

export function documents(): DocumentSet {
  docs ??= buildDocuments(params(), world().world, correctionKey());
  return docs;
}

export function synthesis(): Synthesis {
  syn ??= buildSynthesis(correctionKey(), world().world, params());
  return syn;
}
