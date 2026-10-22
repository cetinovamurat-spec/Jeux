/**
 * View state of the Constats screen (tab, filters, selected finding) and the
 * unsaved drafts of its form: in memory only, they survive moving between
 * tabs, findings and screens, not a reload.
 */
import { create } from 'zustand';
import { evidenceKey, objectKey, type Finding, type FindingDraft, type FindingStatus } from '../../../game/findings';

export type FindingsTab = 'list' | 'table' | 'designer';

interface FindingsView {
  tab: FindingsTab;
  status: FindingStatus | 'all' | 'open';
  cycle: string;
  /** Finding shown in the form ('new' for a new one). */
  selected: string | null;
  update: (changes: Partial<Omit<FindingsView, 'update'>>) => void;
}

export const useFindingsView = create<FindingsView>((set) => ({
  tab: 'list',
  status: 'all',
  cycle: 'all',
  selected: null,
  update: (changes) => set(changes),
}));

/** Unsaved draft of the form, with the saved finding it was started from (null for a new finding). */
export interface KeptDraft {
  draft: FindingDraft;
  base: Finding | null;
}

interface FindingDrafts {
  /** By finding id ('new' for a new finding). */
  drafts: Readonly<Record<string, KeptDraft>>;
  /** Keeps a draft, or drops it (null: saved, deleted, cancelled or back to the saved finding). */
  keep: (key: string, kept: KeptDraft | null) => void;
}

/** Separate from the view state: the screen does not re-render on every keystroke of the form. */
export const useFindingDrafts = create<FindingDrafts>((set) => ({
  drafts: {},
  keep: (key, kept) =>
    set((s) => {
      if (kept) return { drafts: { ...s.drafts, [key]: kept } };
      if (!(key in s.drafts)) return s;
      const { [key]: _dropped, ...drafts } = s.drafts;
      return { drafts };
    }),
}));

/**
 * The kept draft of a form, when it was started from the finding as saved now
 * (`saved` undefined for a new finding): a finding changed since otherwise
 * than by the form (the state replaced) makes it stale.
 */
export function keptDraft(drafts: Readonly<Record<string, KeptDraft>>, key: string, saved: Finding | undefined): FindingDraft | undefined {
  const k = drafts[key];
  return k && k.base === (saved ?? null) ? k.draft : undefined;
}

/**
 * What the form edits, in comparable form (unsaved changes): the lines
 * without an amount, the order of the natures and treatments and the spaces
 * around the title do not count, as they are not saved.
 */
export function draftSignature(d: FindingDraft): string {
  return JSON.stringify([
    d.title.trim(),
    d.cycle,
    d.objects.map(objectKey),
    [...d.natures].sort(),
    d.classification,
    [...d.treatments].sort(),
    d.proposedEntry.filter((l) => l.debit !== 0 || l.credit !== 0).map((l) => [l.account, l.debit, l.credit, l.aux ?? '']),
    d.disclosureFix,
    d.evidence.map(evidenceKey),
    d.status,
    d.comment,
  ]);
}
