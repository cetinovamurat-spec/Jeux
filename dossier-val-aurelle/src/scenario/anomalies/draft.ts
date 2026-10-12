/**
 * Copy-on-write draft of a world: anomalies remove, replace or add 2025
 * entries, patch datasets and record presentation facts. 2024 is untouched
 * (certified accounts), except presentation choices (A22).
 *
 * Closing entries that derive from a sub-ledger (depreciation and subsidy
 * release by programme, receivables impairment) are not patched by hand: an
 * anomaly changes the sub-ledger and marks the programme (or the impairment)
 * as dirty; `finalise` recomputes the entries from the patched data.
 */
import { cleanLines } from '../../engine/ledger';
import type { EntryLine, JournalEntry, World } from '../../engine/types';
import type { ScenarioDatasets } from '../datasets';
import { CLEAN_METHOD, impairmentMovements, type ImpairmentMethod } from '../impairment';
import type { Params } from '../params';
import { depreciationLines, subsidyReleaseLines } from './closing';
import type { AnomalyId } from './types';

type AnnexCell = World['presentation']['annexCells'][number];

export interface PresentationFacts {
  /** Management report: values shown instead of the computed ones (A14). */
  report: Record<string, unknown>;
  /** Document variants (e.g. 'pge.dafVersion'). */
  documents: Record<string, unknown>;
}

export class WorldDraft {
  readonly entries: JournalEntry[];
  readonly data: ScenarioDatasets;
  readonly facts: PresentationFacts = { report: {}, documents: {} };
  readonly reclassifications: { account: string; to: string; years: number[] }[] = [];
  readonly annexCells: AnnexCell[] = [];
  impairmentMethod: ImpairmentMethod = { ...CLEAN_METHOD };
  impairmentDirty = false;
  readonly dirtyProgrammes = new Set<string>();
  /** Entry id → anomalies that touched it (overlap checks). */
  readonly touched = new Map<string, AnomalyId[]>();
  private current: AnomalyId | null = null;
  private seq = 0;

  constructor(readonly clean: World) {
    this.entries = [...clean.ledgers.current.entries];
    this.data = { ...(clean.datasets as unknown as ScenarioDatasets) };
  }

  setCurrent(id: AnomalyId | null): void {
    this.current = id;
  }

  private touch(id: string): void {
    if (!this.current) return;
    const list = this.touched.get(id) ?? [];
    if (!list.includes(this.current)) list.push(this.current);
    this.touched.set(id, list);
  }

  find(pred: (e: JournalEntry) => boolean): JournalEntry[] {
    return this.entries.filter(pred);
  }

  one(pred: (e: JournalEntry) => boolean, what: string): JournalEntry {
    const found = this.entries.filter(pred);
    if (found.length !== 1) throw new Error(`${this.current ?? ''} : ${found.length} écriture(s) trouvée(s) pour ${what}`);
    return found[0]!;
  }

  byPiece(pieceRef: string): JournalEntry[] {
    return this.entries.filter((e) => e.pieceRef === pieceRef);
  }

  remove(entry: JournalEntry): void {
    const i = this.entries.indexOf(entry);
    if (i < 0) throw new Error(`${this.current ?? ''} : écriture ${entry.id} absente`);
    this.entries.splice(i, 1);
    this.touch(entry.id);
  }

  replace(entry: JournalEntry, changes: Partial<Omit<JournalEntry, 'id'>>): JournalEntry {
    const i = this.entries.indexOf(entry);
    if (i < 0) throw new Error(`${this.current ?? ''} : écriture ${entry.id} absente`);
    const next: JournalEntry = { ...entry, ...changes, lines: changes.lines ? cleanLines(changes.lines) : entry.lines };
    this.entries[i] = next;
    this.touch(entry.id);
    return next;
  }

  add(input: Omit<JournalEntry, 'id' | 'origin' | 'lines'> & { lines: readonly EntryLine[] }, origin?: string): JournalEntry {
    this.seq++;
    const tag = this.current ?? 'X';
    const entry: JournalEntry = { ...input, lines: cleanLines(input.lines), id: `2025:${tag}:${String(this.seq).padStart(3, '0')}`, origin: origin ?? `anomaly:${tag}` };
    this.entries.push(entry);
    this.touch(entry.id);
    return entry;
  }

  /** Replaces a dataset (copy-on-write: never mutate the clean arrays or their objects). */
  setDataset<K extends keyof ScenarioDatasets>(key: K, value: ScenarioDatasets[K]): void {
    (this.data as unknown as Record<string, unknown>)[key] = value;
  }

  markProgramme(programmeId: string): void {
    this.dirtyProgrammes.add(programmeId);
  }

  /** Recomputes the closing entries derived from patched sub-ledgers. */
  finalise(params: Params): void {
    this.setCurrent(null);
    for (const pid of [...this.dirtyProgrammes].sort()) {
      this.syncClosing(`INV2025-AMORT-${pid}`, depreciationLines(this.data.components, pid, 2025));
      this.syncClosing(`INV2025-QPS-${pid}`, subsidyReleaseLines(this.data.subsidies, this.data.components, pid, 2025));
    }
    if (this.impairmentDirty) {
      const e = this.one((x) => x.pieceRef === 'INV2025-DEPR', 'la dépréciation des créances');
      this.replace(e, { lines: impairmentMovements(this.data.tenants, params, 2025, this.impairmentMethod).lines });
    }
  }

  private syncClosing(pieceRef: string, lines: EntryLine[]): void {
    const existing = this.byPiece(pieceRef);
    if (existing.length > 1) throw new Error(`plusieurs écritures ${pieceRef}`);
    const e = existing[0];
    if (!lines.length) {
      if (e) this.remove(e);
      return;
    }
    if (e) {
      if (!sameLines(e.lines, lines)) this.replace(e, { lines });
      return;
    }
    const template = this.clean.ledgers.current.entries.find((x) => x.pieceRef === pieceRef);
    if (!template) throw new Error(`écriture de clôture ${pieceRef} sans modèle dans le monde propre`);
    const i = this.clean.ledgers.current.entries.indexOf(template);
    this.entries.splice(Math.min(i, this.entries.length), 0, { ...template, lines: cleanLines(lines) });
  }

  toWorld(): World {
    return {
      ...this.clean,
      ledgers: { prior: this.clean.ledgers.prior, current: { ...this.clean.ledgers.current, entries: this.entries } },
      datasets: this.data as unknown as Record<string, unknown>,
      presentation: {
        reclassifications: [...this.clean.presentation.reclassifications, ...this.reclassifications],
        annexCells: [...this.clean.presentation.annexCells, ...this.annexCells],
      },
    };
  }
}

function sameLines(a: readonly EntryLine[], b: readonly EntryLine[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    if (x.account !== y.account || x.debit !== y.debit || x.credit !== y.credit || (x.aux ?? '') !== (y.aux ?? '')) return false;
  }
  return true;
}
