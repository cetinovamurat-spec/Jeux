/**
 * View state of the planning screen (library filters, materiality draft). In
 * memory only: it survives moving between screens, not a reload. The draft of
 * the materiality is validated by an explicit action only.
 */
import { create } from 'zustand';
import type { MaterialityVintage } from '../../../game/planning';

export interface LibraryFilter {
  cycle: string;
  /** 'all', 'high' (procedures covering the cycles assessed high or significant), 'uncovered' (risks without a response). */
  risk: 'all' | 'high' | 'uncovered';
  phase: string;
  query: string;
}

export interface MaterialityDraft {
  base: string;
  vintage: MaterialityVintage | null;
  /** Inputs as typed (French decimal comma accepted). */
  pct: string;
  rounding: number;
  planningPct: string;
  trivialPct: string;
  specific: boolean;
  specificPct: string;
  factors: string[];
  comment: string;
}

interface PlanningView {
  library: LibraryFilter;
  draft: MaterialityDraft | null;
  setLibrary: (changes: Partial<LibraryFilter>) => void;
  setDraft: (draft: MaterialityDraft | null) => void;
  updateDraft: (changes: Partial<MaterialityDraft>) => void;
}

export const DEFAULT_LIBRARY: LibraryFilter = { cycle: 'all', risk: 'all', phase: 'all', query: '' };

export const usePlanningView = create<PlanningView>((set) => ({
  library: DEFAULT_LIBRARY,
  draft: null,
  setLibrary: (changes) => set((s) => ({ library: { ...s.library, ...changes } })),
  setDraft: (draft) => set({ draft }),
  updateDraft: (changes) => set((s) => (s.draft ? { draft: { ...s.draft, ...changes } } : {})),
}));

/** Number typed with a French decimal comma (NaN when invalid). */
export function parseDecimal(text: string): number {
  const t = text.trim().replace(/\s/g, '').replace(',', '.');
  return t === '' ? Number.NaN : Number(t);
}

export function decimalText(x: number): string {
  return x.toLocaleString('fr-FR', { maximumFractionDigits: 2, useGrouping: false });
}
