/**
 * Public key of an entry in the addresses (?ecriture=): its FEC number
 * (EcritureNum, unique within a year). The internal id is never shown to the
 * player: it can name the anomaly that created the entry.
 */
import type { FecIndex } from '../../../game/fec-query';

const cache = new WeakMap<FecIndex, ReadonlyMap<string, string>>();

/** Internal id of every entry of the year, by FEC number. */
export function entryIdsByNumber(index: FecIndex): ReadonlyMap<string, string> {
  let map = cache.get(index);
  if (!map) {
    const m = new Map<string, string>();
    for (const [id, lines] of index.entryLines) {
      const first = lines[0];
      if (first !== undefined) m.set(index.lines[first]!.EcritureNum, id);
    }
    cache.set(index, m);
    map = m;
  }
  return map;
}

/** FEC number of an entry (its public key), from its internal id. */
export function entryNumber(index: FecIndex, entryId: string): string | undefined {
  const first = index.entryLines.get(entryId)?.[0];
  return first === undefined ? undefined : index.lines[first]!.EcritureNum;
}
