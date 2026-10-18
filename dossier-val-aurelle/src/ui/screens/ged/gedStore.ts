/**
 * View state of the GED (tab, search, filters, sort, list visibility, family
 * selected in the request catalogue). In memory only: it survives moving
 * between documents and screens, not a reload.
 */
import { create } from 'zustand';
import { DEFAULT_DOCUMENT_FILTER, type DocumentFilter } from '../../../game/documents';
import type { GedTab } from './labels';

export interface GedView extends DocumentFilter {
  tab: GedTab;
  query: string;
  listHidden: boolean;
  /** Family selected in the catalogue of requests. */
  family: string;
}

interface GedViewStore extends GedView {
  update: (changes: Partial<GedView>) => void;
  resetFilters: () => void;
}

export const useGedView = create<GedViewStore>((set) => ({
  ...DEFAULT_DOCUMENT_FILTER,
  tab: 'documents',
  query: '',
  listHidden: false,
  family: 'interim-extraction',
  update: (changes) => set(changes),
  resetFilters: () => set({ ...DEFAULT_DOCUMENT_FILTER, query: '' }),
}));
