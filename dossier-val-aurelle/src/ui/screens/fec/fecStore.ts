/**
 * View state of the FEC explorer: the query being edited and the raw text of
 * the fields that are parsed (account prefixes, amounts, rare-pair threshold),
 * plus the state of the criteria panel. In memory only: it survives moving
 * between screens, not a reload (saved queries are in the game state).
 */
import { create } from 'zustand';
import { EMPTY_QUERY, euroInputText, parseAccountPrefixes, parseEuroAmount, type FecQuery } from '../../../game/fec-query';
import { loadParams } from '../../../scenario/params';

export type PanelTab = 'filters' | 'saved' | 'journals';

export interface FecView {
  query: FecQuery;
  accountsText: string;
  minText: string;
  maxText: string;
  /** Rare-pair filter switched on (the threshold below applies). */
  rareOn: boolean;
  rareText: string;
  panelOpen: boolean;
  panelTab: PanelTab;
}

interface FecViewStore extends FecView {
  /** Changes plain query fields (journals, users, dates, flags, keywords…). */
  patch: (changes: Partial<FecQuery>) => void;
  /** Replaces the whole query (preset, saved query) and the raw texts derived from it. */
  load: (query: FecQuery) => void;
  reset: () => void;
  setAccountsText: (text: string) => void;
  setAmountText: (bound: 'min' | 'max', text: string) => void;
  setRare: (on: boolean, text?: string) => void;
  setPanel: (changes: Partial<Pick<FecView, 'panelOpen' | 'panelTab'>>) => void;
}

export function defaultRareMax(): number {
  return loadParams().game.rarePairMaxOccurrences;
}

/** Threshold typed in the rare-pair field (default while it is empty or invalid). */
export function rareThreshold(text: string): number {
  const n = Number(text);
  return Number.isInteger(n) && n >= 1 ? n : defaultRareMax();
}

type QueryFields = Pick<FecView, 'query' | 'accountsText' | 'minText' | 'maxText' | 'rareOn' | 'rareText'>;

function fromQuery(query: FecQuery, rareText: string): QueryFields {
  const q: FecQuery = { ...EMPTY_QUERY, ...query };
  return {
    query: q,
    accountsText: q.accounts.join(' '),
    minText: euroInputText(q.minAmount),
    maxText: euroInputText(q.maxAmount),
    rareOn: q.rarePairsMax > 0,
    rareText: q.rarePairsMax > 0 ? String(q.rarePairsMax) : rareText,
  };
}

export const useFecView = create<FecViewStore>((set) => ({
  ...fromQuery(EMPTY_QUERY, String(defaultRareMax())),
  panelOpen: true,
  panelTab: 'filters',
  patch: (changes) => set((s) => ({ query: { ...s.query, ...changes } })),
  load: (query) => set((s) => fromQuery(query, s.rareText)),
  reset: () => set(() => fromQuery(EMPTY_QUERY, String(defaultRareMax()))),
  setAccountsText: (text) => set((s) => ({ accountsText: text, query: { ...s.query, accounts: parseAccountPrefixes(text) } })),
  setAmountText: (bound, text) =>
    set((s) => {
      const { cents, valid } = parseEuroAmount(text);
      // An invalid entry leaves the bound off until it is corrected (the field shows the error).
      const value = valid ? cents : null;
      return bound === 'min' ? { minText: text, query: { ...s.query, minAmount: value } } : { maxText: text, query: { ...s.query, maxAmount: value } };
    }),
  setRare: (on, text) =>
    set((s) => {
      const t = text ?? s.rareText;
      return { rareOn: on, rareText: t, query: { ...s.query, rarePairsMax: on ? rareThreshold(t) : 0 } };
    }),
  setPanel: (changes) => set(changes),
}));
