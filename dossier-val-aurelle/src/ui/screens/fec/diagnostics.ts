/**
 * Designer-mode diagnostics of the FEC explorer: origin of each entry of the
 * presented FEC and comparison with the clean world (never shown to the player).
 */
import type { JournalEntry } from '../../../engine/types';
import type { CaseData, Year } from '../../app/case';

export interface EntryDiagnostic {
  /** 'gen:<stream>' | 'anomaly:<id>' … (JournalEntry.origin). */
  origin: string;
  /** Compared with the entry of the same id in the clean world. */
  change: 'added' | 'modified' | null;
}

export interface Diagnostics {
  entries: ReadonlyMap<string, EntryDiagnostic>;
  /** Entries of the clean world that are absent from the presented FEC. */
  removed: number;
}

function sameEntry(a: JournalEntry, b: JournalEntry): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

export function buildDiagnostics(c: CaseData, year: Year): Diagnostics {
  const current = year === c.params.scenario.years.current;
  const presented = current ? c.presented.ledgers.current : c.presented.ledgers.prior;
  const clean = current ? c.clean.ledgers.current : c.clean.ledgers.prior;
  const cleanById = new Map(clean.entries.map((e) => [e.id, e]));
  const entries = new Map<string, EntryDiagnostic>();
  for (const e of presented.entries) {
    const ce = cleanById.get(e.id);
    entries.set(e.id, { origin: e.origin, change: !ce ? 'added' : sameEntry(ce, e) ? null : 'modified' });
  }
  let removed = 0;
  for (const id of cleanById.keys()) if (!entries.has(id)) removed++;
  return { entries, removed };
}

/** The entry was created or changed by an anomaly. */
export function isTouched(d: EntryDiagnostic | undefined): boolean {
  return !!d && (d.change !== null || d.origin.startsWith('anomaly:'));
}

/** Short label of the origin: 'A11', or the generator stream ('CLO'). */
export function originLabel(origin: string): string {
  const [kind = '', id = ''] = origin.split(':');
  return kind === 'gen' ? id : id || kind;
}
