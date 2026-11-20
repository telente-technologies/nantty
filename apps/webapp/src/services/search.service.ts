import type { RecentSearchEntry, SearchPage, SearchResultType, SearchScopeKey, SearchSuggestion } from "@/types/search.type";

import { sendListRequestToWebappServer, sendRequestToWebappServer } from "./clientApi.service";

export const searchService = {
  searchWithinScope: (query: string, scope: SearchScopeKey, type: SearchResultType, cursor: string | null) =>
    sendRequestToWebappServer<SearchPage>("/api/v1/search", { query: { q: query, scope, type, cursor: cursor ?? undefined } }),
  suggestSearch: (query: string) => sendListRequestToWebappServer<SearchSuggestion>("/api/v1/search/suggest", { query: { q: query } }),
  listRecentSearches: (scope: SearchScopeKey) => sendRequestToWebappServer<{ data: RecentSearchEntry[] }>("/api/v1/search/recent", { query: { scope } }),
  recordRecentSearch: (query: string, scope: SearchScopeKey) => sendRequestToWebappServer<void>("/api/v1/search/recent", { method: "POST", body: { q: query, scope } }),
  removeRecentSearch: (id: string) => sendRequestToWebappServer<void>(`/api/v1/search/recent/${encodeURIComponent(id)}`, { method: "DELETE" }),
  clearRecentSearches: (scope: SearchScopeKey) => sendRequestToWebappServer<void>("/api/v1/search/recent", { method: "DELETE", query: { scope } }),
};
