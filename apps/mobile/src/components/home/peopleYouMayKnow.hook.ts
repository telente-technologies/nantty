import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";

import { useFollowUserToggle } from "@/components/profile/confirmedFollowToggle.hook";
import { peopleYouMayKnowFetchLimit } from "@/constants/feedModules.constant";
import { useRequireAuth } from "@/hooks/useRequireAuth.hook";
import { exploreService } from "@/services/feed/explore.service";
import { useAuthStore } from "@/store/auth.store";
import { useFeedModulePreferencesStore } from "@/store/feedModulePreferences.store";
import type { FollowSuggestion } from "@/types/explore.type";
import type { FollowState } from "@/types/socialGraph.type";

export const peopleYouMayKnowQueryKey = ["suggestions", "peopleYouMayKnow"] as const;
const noDismissedPeople: readonly string[] = [];

export function usePeopleYouMayKnow({ enabled = true }: { readonly enabled?: boolean } = {}) {
  const { requireAuthThen } = useRequireAuth();
  const viewerId = useAuthStore((state) => (state.status === "signedIn" ? state.user?.id ?? null : null));
  const dismissedIds = useFeedModulePreferencesStore((state) => (viewerId ? state.dismissedSuggestedPeopleByViewer[viewerId] : undefined)) ?? noDismissedPeople;
  const dismissSuggestedPerson = useFeedModulePreferencesStore((state) => state.dismissSuggestedPerson);
  const [followStates, setFollowStates] = useState<ReadonlyMap<string, FollowState>>(new Map());
  const { toggleUser } = useFollowUserToggle();
  const query = useQuery({
    queryKey: [...peopleYouMayKnowQueryKey, viewerId],
    queryFn: () => exploreService.fetchPeopleYouMayKnow(peopleYouMayKnowFetchLimit),
    enabled,
    staleTime: 600_000,
  });

  const suggestions = useMemo(() => {
    const dismissed = new Set(dismissedIds);
    return (query.data?.data ?? []).filter((suggestion) => suggestion.user.id !== viewerId && !dismissed.has(suggestion.user.id));
  }, [query.data, dismissedIds, viewerId]);

  const followStateFor = useCallback((userId: string): FollowState => followStates.get(userId) ?? "none", [followStates]);

  const toggleFollow = useCallback((suggestion: FollowSuggestion) =>
    requireAuthThen(() => toggleUser(
      { id: suggestion.user.id, username: suggestion.user.username, followState: followStates.get(suggestion.user.id) ?? "none", isPrivate: suggestion.isPrivate === true },
      (state) => setFollowStates((current) => new Map(current).set(suggestion.user.id, state)),
    ), "follow people"), [requireAuthThen, toggleUser, followStates]);

  const dismiss = useCallback((suggestion: FollowSuggestion) => {
    if (viewerId) dismissSuggestedPerson(viewerId, suggestion.user.id);
  }, [viewerId, dismissSuggestedPerson]);

  return { suggestions, isLoading: query.isLoading, followStateFor, toggleFollow, dismiss, refetch: query.refetch };
}
