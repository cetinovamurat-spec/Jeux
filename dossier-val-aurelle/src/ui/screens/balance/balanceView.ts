/**
 * View state of the balance N / N-1 (filters and display options). In memory
 * only: it survives a trip to the general ledger and back, not a reload.
 */
import { create } from 'zustand';

export interface BalanceView {
  text: string;
  accountClass: string;
  /** Raw inputs (euros, percent), parsed by the screen. */
  minVariation: string;
  minRatio: string;
  hideSettled: boolean;
  cents: boolean;
  showOpening: boolean;
  /** Designer mode: only the accounts whose balance differs from the clean world. */
  changedOnly: boolean;
}

const DEFAULT_VIEW: BalanceView = { text: '', accountClass: '', minVariation: '', minRatio: '', hideSettled: false, cents: false, showOpening: false, changedOnly: false };

interface BalanceViewStore extends BalanceView {
  update: (changes: Partial<BalanceView>) => void;
  resetFilters: () => void;
}

export const useBalanceView = create<BalanceViewStore>((set) => ({
  ...DEFAULT_VIEW,
  update: (changes) => set(changes),
  resetFilters: () => set({ text: '', accountClass: '', minVariation: '', minRatio: '', hideSettled: false, changedOnly: false }),
}));
