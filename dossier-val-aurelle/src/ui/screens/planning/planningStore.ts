/**
 * View state of the planning screen (library filters, materiality draft). In
 * memory only: it survives moving between screens, not a reload. The draft of
 * the materiality is validated by an explicit action only.
 */
import { create } from 'zustand';
import { materialityFrom, type MaterialityChoice, type MaterialityVintage } from '../../../game/planning';

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

export function decimalText(x: number, digits = 2): string {
  return x.toLocaleString('fr-FR', { maximumFractionDigits: digits, useGrouping: false });
}

/** Percentages of a decision in force, as typed back into the draft (no loss of precision). */
const EXACT_DIGITS = 6;

/** Default rounding of a new materiality: the finest round unit offered (params `planning.thresholds.roundingEuros`). */
export function defaultRounding(units: readonly number[]): number {
  return units.find((u) => u > 0) ?? units[0] ?? 0;
}

/**
 * Rounding of a validated materiality, which stores only the rounded amount:
 * the largest unit offered that rebuilds that amount from its base and
 * percentage (the default when none does).
 */
export function roundingOf(c: Pick<MaterialityChoice, 'baseAmount' | 'pct' | 'amount'>, units: readonly number[]): number {
  const fits = units.filter((u) => materialityFrom(c.baseAmount, c.pct, u) === c.amount);
  return fits.length > 0 ? Math.max(...fits) : defaultRounding(units);
}

export function emptyDraft(vintage: MaterialityVintage, units: readonly number[]): MaterialityDraft {
  return { base: '', vintage, pct: '', rounding: defaultRounding(units), planningPct: '', trivialPct: '', specific: false, specificPct: '', factors: [], comment: '' };
}

/** Draft rebuilt from the decision in force (after a reload, or on newer data): same base, percentages and rounding. */
export function draftFrom(c: MaterialityChoice, vintage: MaterialityVintage, units: readonly number[]): MaterialityDraft {
  return {
    base: c.base,
    vintage,
    pct: decimalText(c.pct, EXACT_DIGITS),
    rounding: roundingOf(c, units),
    planningPct: decimalText(c.planningPct, EXACT_DIGITS),
    trivialPct: decimalText(c.trivialPct, EXACT_DIGITS),
    specific: c.specificPct !== null,
    specificPct: c.specificPct === null ? '' : decimalText(c.specificPct, EXACT_DIGITS),
    factors: c.factors,
    comment: c.comment,
  };
}
