/** View state of the Constats screen (tab, filters, selected finding): in memory only, it survives moving between screens, not a reload. */
import { create } from 'zustand';
import type { FindingStatus } from '../../../game/findings';

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
