/**
 * View state of the GED (search, filters, sort, list visibility). In memory
 * only: it survives moving between documents and screens, not a reload.
 */
import { create } from 'zustand';
import { DEFAULT_DOCUMENT_FILTER, type DocumentFilter } from '../../../game/documents';

export interface GedView extends DocumentFilter {
  query: string;
  listHidden: boolean;
}

interface GedViewStore extends GedView {
  update: (changes: Partial<GedView>) => void;
  resetFilters: () => void;
}

export const useGedView = create<GedViewStore>((set) => ({
  ...DEFAULT_DOCUMENT_FILTER,
  query: '',
  listHidden: false,
  update: (changes) => set(changes),
  resetFilters: () => set({ ...DEFAULT_DOCUMENT_FILTER, query: '' }),
}));
