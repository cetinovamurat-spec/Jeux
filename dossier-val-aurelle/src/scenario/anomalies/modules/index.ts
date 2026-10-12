/** Anomaly modules in canonical order (order of application and of the correction entries). */
import type { AnomalyModule, PartKey } from '../types';
import { A08, A09, A18, A20 } from './debt';
import { A12, A13, A14, A21, A22 } from './disclosures';
import { A01, A02, A03, A04, A06, A16 } from './fixed-assets';
import { A05, A07, A15 } from './provisions';
import { A10, A11, A17, A19 } from './revenue';

export const ANOMALIES: readonly AnomalyModule[] = [A01, A02, A03, A04, A05, A06, A07, A08, A09, A10, A11, A12, A13, A14, A15, A16, A17, A18, A19, A20, A21, A22];

/** Every part key in canonical order. */
export const PART_KEYS: readonly PartKey[] = ANOMALIES.flatMap((m) => m.parts.map((p) => p.id));

export function moduleOf(key: PartKey): AnomalyModule {
  const m = ANOMALIES.find((x) => x.parts.some((p) => p.id === key) || x.id === key);
  if (!m) throw new Error(`anomalie inconnue : ${key}`);
  return m;
}
