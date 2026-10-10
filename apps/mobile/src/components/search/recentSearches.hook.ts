import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { searchService } from "@/services/feed/search.service";
import { useAuthStore } from "@/store/auth.store";
import type { SearchScopeKey } from "@/types/search.type";

export function useRecentSearches(scope: SearchScopeKey) {
  const queryClient = useQueryClient();
  const isSignedIn = useAuthStore((state) => state.status === "signedIn");
  const queryKey = ["search", "recent", scope] as const;
  const recent = useQuery({ queryKey, queryFn: () => searchService.listRecentSearches(scope), enabled: isSignedIn, staleTime: 30_000 });
  const refresh = () => void queryClient.invalidateQueries({ queryKey });
  const record = useMutation({ mutationFn: (query: string) => searchService.recordRecentSearch(query, scope), onSettled: refresh });
  const remove = useMutation({ mutationFn: (id: string) => searchService.removeRecentSearch(id), onSettled: refresh });
  const clear = useMutation({ mutationFn: () => searchService.clearRecentSearches(scope), onSettled: refresh });
  return {
    entries: isSignedIn ? (recent.data?.data ?? []) : [],
    recordSearch: (query: string) => {
      if (isSignedIn && query.trim() !== "") record.mutate(query.trim());
    },
    removeSearch: (id: string) => remove.mutate(id),
    clearSearches: () => clear.mutate(),
  };
}
