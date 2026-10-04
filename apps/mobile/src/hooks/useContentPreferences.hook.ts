import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { contentPreferencesService } from "@/services/contentPreferences.service";
import { useAuthStore } from "@/store/auth.store";

export const CONTENT_PREFERENCES_QUERY_KEY = ["content-preferences"] as const;

export function useContentPreferences() {
  const isSignedIn = useAuthStore((state) => state.status === "signedIn");
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: CONTENT_PREFERENCES_QUERY_KEY, queryFn: contentPreferencesService.fetchContentPreferences, enabled: isSignedIn, staleTime: 5 * 60_000 });
  const update = useMutation({
    mutationFn: contentPreferencesService.updateContentPreferences,
    onSuccess: (preferences) => {
      queryClient.setQueryData(CONTENT_PREFERENCES_QUERY_KEY, preferences);
      queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
  });
  return { query, update, isAdult: query.data?.ageBracket === "adult" };
}
