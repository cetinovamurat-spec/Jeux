/** Extractions from the ledgers and sub-ledgers used by several document templates. */
import type { Cents } from '../../engine/money';
import type { JournalEntry, World } from '../../engine/types';

const progOf = (refs: readonly string[] | undefined): string | undefined => refs?.find((r) => r.startsWith('prog:'))?.slice(5);

/**
 * Work in progress (2312, 2313) by programme at the end of the current year:
 * the 2024 ledger carries programme references on every line; the 2025
 * opening entry is aggregated, so 2025 starts from the 2024 closing by programme.
 */
export function wipByProgramme(world: World): Map<string, Cents> {
  const m = new Map<string, Cents>();
  const add = (e: JournalEntry) => {
    for (const l of e.lines) {
      if (l.account !== '2312' && l.account !== '2313') continue;
      const p = progOf(l.refs) ?? '?';
      m.set(p, (m.get(p) ?? 0) + l.debit - l.credit);
    }
  };
  for (const e of world.ledgers.prior.entries) add(e);
  for (const e of world.ledgers.current.entries) if (e.journal !== 'AN') add(e);
  for (const [k, v] of m) if (v === 0) m.delete(k);
  return m;
}

/** Rents invoiced (quittancement, before RLS) by programme and month, from the rent interface entries. */
export function rentRollByProgramme(world: World): Map<string, Cents[]> {
  const m = new Map<string, Cents[]>();
  for (const e of world.ledgers.current.entries) {
    if (e.journal !== 'QT' || !e.pieceRef?.startsWith('QT')) continue;
    const month = Number(e.date.slice(5, 7));
    for (const l of e.lines) {
      if (!['70411', '70412', '70414', '70415'].includes(l.account)) continue;
      const p = progOf(l.refs) ?? '?';
      const row = m.get(p) ?? new Array<Cents>(12).fill(0);
      row[month - 1] = row[month - 1]! + l.credit - l.debit;
      m.set(p, row);
    }
  }
  return m;
}

export function entriesOf(world: World, pred: (e: JournalEntry) => boolean): JournalEntry[] {
  return world.ledgers.current.entries.filter(pred);
}

export function entryAmount(e: JournalEntry): Cents {
  return e.lines.reduce((s, l) => s + l.debit, 0);
}

/** Credit movements of the year (opening entry excluded) on accounts starting with the prefixes. */
export function creditsOn(world: World, prefixes: readonly string[]): Cents {
  let s = 0;
  for (const e of world.ledgers.current.entries) {
    if (e.journal === 'AN') continue;
    for (const l of e.lines) if (prefixes.some((p) => l.account.startsWith(p))) s += l.credit;
  }
  return s;
}
