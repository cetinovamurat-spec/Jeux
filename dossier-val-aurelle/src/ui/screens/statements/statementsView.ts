/**
 * View state of the statements screen (quick-tick mark, detail opened in each
 * tab). In memory only: it survives moving between screens, not a reload.
 */
import { create } from 'zustand';
import type { TabId } from './labels';

export type Selection = { kind: 'line'; lineId: string } | { kind: 'annex'; tableId: string; rowId: string };

interface StatementsViewStore {
  /** Mark applied by a plain click on a cell (null: a click opens the menu of marks). */
  clickMark: string | null;
  /** Detail panel opened in each tab. */
  selection: Partial<Record<TabId, Selection>>;
  setClickMark: (id: string | null) => void;
  select: (tab: TabId, s: Selection | null) => void;
}

export const useStatementsView = create<StatementsViewStore>((set) => ({
  clickMark: null,
  selection: {},
  setClickMark: (clickMark) => set({ clickMark }),
  select: (tab, s) =>
    set((st) => {
      const selection = { ...st.selection };
      if (s) selection[tab] = s;
      else delete selection[tab];
      return { selection };
    }),
}));

export function sameSelection(a: Selection | null | undefined, b: Selection | null | undefined): boolean {
  if (!a || !b || a.kind !== b.kind) return false;
  if (a.kind === 'line' && b.kind === 'line') return a.lineId === b.lineId;
  if (a.kind === 'annex' && b.kind === 'annex') return a.tableId === b.tableId && a.rowId === b.rowId;
  return false;
}
