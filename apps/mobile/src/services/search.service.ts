import type { RecentSearchEntry, SearchPage, SearchResultType, SearchScopeKey } from "@/types/search.type";

import { api } from "./apiClient.service";

export const searchService = {
  searchWithinScope: (query: string, scope: SearchScopeKey, type: SearchResultType, cursor: string | null) =>
    api.get<SearchPage>("/api/v1/search", { q: query, scope, type, cursor: cursor ?? undefined }),
  listRecentSearches: (scope: SearchScopeKey) => api.get<{ data: RecentSearchEntry[] }>("/api/v1/search/recent", { scope }),
  recordRecentSearch: (query: string, scope: SearchScopeKey) => api.post<void>("/api/v1/search/recent", { q: query, scope }),
  removeRecentSearch: (id: string) => api.delete<void>(`/api/v1/search/recent/${encodeURIComponent(id)}`),
  clearRecentSearches: (scope: SearchScopeKey) => api.delete<void>("/api/v1/search/recent", { query: { scope } }),
};
