/**
 * Display options of the general ledger, kept while moving between accounts
 * and screens (in memory only).
 */
import { create } from 'zustand';

interface LedgerViewStore {
  /** Lettering, validation date and user columns. */
  controlColumns: boolean;
  /** Totals per auxiliary account instead of the lines. */
  grouped: boolean;
  update: (changes: Partial<Pick<LedgerViewStore, 'controlColumns' | 'grouped'>>) => void;
}

export const useLedgerView = create<LedgerViewStore>((set) => ({
  controlColumns: true,
  grouped: false,
  update: (changes) => set(changes),
}));
