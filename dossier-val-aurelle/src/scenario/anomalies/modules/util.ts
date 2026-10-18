/** Small helpers shared by the anomaly modules. */
import type { AnomalyContext, DisclosureItemRef } from '../types';

export function programmeName(ctx: AnomalyContext, id: string): string {
  return ctx.params.programmes.find((p) => p.id === id)?.name ?? id;
}

/** Shallow copy without one optional property (copy-on-write of dataset objects). */
export function without<T extends object, K extends keyof T>(obj: T, key: K): T {
  const copy = { ...obj };
  delete copy[key];
  return copy;
}

/** Item of the annex or of the management report (params/disclosure-items.json), object of a finding. */
export const item = (id: string): DisclosureItemRef => ({ kind: 'disclosureItem', id });
