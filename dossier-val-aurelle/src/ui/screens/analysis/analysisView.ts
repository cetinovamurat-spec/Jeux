/**
 * View state of the analytical review: active tab, thresholds as typed,
 * filters and the "data table" toggles of the charts. In memory only: it
 * survives moving between screens, not a reload.
 */
import { create } from 'zustand';
import { formatAmount } from '../../../engine/format';
import { DEFAULT_VARIATION_THRESHOLDS } from '../../../game/analysis';

export type AnalysisTab = 'income' | 'balance' | 'ratios' | 'charts';

export interface AnalysisView {
  tab: AnalysisTab;
  /** Raw inputs (percent, euros), parsed by the screen. */
  pctText: string;
  eurosText: string;
  /** Shows only the lines whose variation exceeds the thresholds. */
  flaggedOnly: boolean;
  /** Charts whose underlying table is shown. */
  dataShown: Readonly<Record<string, boolean>>;
}

export function defaultThresholdTexts(): Pick<AnalysisView, 'pctText' | 'eurosText'> {
  return { pctText: String(DEFAULT_VARIATION_THRESHOLDS.pct), eurosText: formatAmount(Math.round(DEFAULT_VARIATION_THRESHOLDS.euros * 100), 0) };
}

interface AnalysisViewStore extends AnalysisView {
  update: (changes: Partial<Omit<AnalysisView, 'dataShown'>>) => void;
  resetThresholds: () => void;
  toggleData: (chart: string) => void;
}

export const useAnalysisView = create<AnalysisViewStore>((set) => ({
  tab: 'income',
  ...defaultThresholdTexts(),
  flaggedOnly: false,
  dataShown: {},
  update: (changes) => set(changes),
  resetThresholds: () => set({ ...defaultThresholdTexts(), flaggedOnly: false }),
  toggleData: (chart) => set((s) => ({ dataShown: { ...s.dataShown, [chart]: !s.dataShown[chart] } })),
}));
