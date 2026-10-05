import { create } from "zustand";

import type { SearchContext } from "@/types/search.type";

interface SearchScopeState {
  readonly pageContext: SearchContext | null;
  readonly setPageContext: (context: SearchContext | null) => void;
}

export const useSearchScopeStore = create<SearchScopeState>((set) => ({
  pageContext: null,
  setPageContext: (pageContext) => set({ pageContext }),
}));
