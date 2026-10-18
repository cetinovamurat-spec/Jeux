/** View state of the work screen (tab, filter, selection). In memory only. */
import { create } from 'zustand';

export type WorkTab = 'procedures' | 'feuilles';
export type WorkFilter = 'all' | 'launchable' | 'toLaunch' | 'running' | 'toDocument' | 'documented';

interface WorkView {
  filter: WorkFilter;
  /** Procedure selected in the list. */
  selected: string | null;
  /** Cycle of the master sheet shown. */
  cycle: string;
  set: (changes: Partial<Omit<WorkView, 'set'>>) => void;
}

export const useWorkView = create<WorkView>((set) => ({
  filter: 'all',
  selected: null,
  cycle: 'crossCycle',
  set: (changes) => set(changes),
}));
