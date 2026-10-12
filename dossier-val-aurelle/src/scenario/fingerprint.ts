/** Browser-safe fingerprint of a generated world (stored in scenario.lock.json and in save files). */
import { closingBalances, netResult } from '../engine/balance';
import type { GenerationResult } from './generator';

/** cyrb53 — fast 53-bit string hash (not cryptographic). */
export function hash53(str: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}

export interface WorldFingerprint {
  hash: string;
  entries: { prior: number; current: number };
  lines: { prior: number; current: number };
  netResult: { prior: number; current: number };
  components: number;
  leases: number;
  invoices: number;
}

export function worldFingerprint(r: GenerationResult): WorldFingerprint {
  const w = r.world;
  const ds = w.datasets as Record<string, readonly unknown[]>;
  return {
    hash: hash53(JSON.stringify(w)),
    entries: { prior: w.ledgers.prior.entries.length, current: w.ledgers.current.entries.length },
    lines: { prior: w.ledgers.prior.entries.reduce((s, e) => s + e.lines.length, 0), current: w.ledgers.current.entries.reduce((s, e) => s + e.lines.length, 0) },
    netResult: { prior: netResult(closingBalances(w.ledgers.prior)), current: netResult(closingBalances(w.ledgers.current)) },
    components: ds['components']!.length,
    leases: ds['leases']!.length,
    invoices: ds['invoices']!.length,
  };
}
