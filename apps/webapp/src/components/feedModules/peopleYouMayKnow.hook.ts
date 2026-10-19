"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import { useSession } from "@/components/providers/sessionProvider";
import { peopleYouMayKnowFetchLimit } from "@/config/feedModules.config";
import { discoveryService } from "@/services/discovery.service";
import { useFeedModulePreferencesStore } from "@/store/feedModulePreferences.store";
import type { FollowSuggestion } from "@/types/explore.type";

const noDismissedPeople: readonly string[] = [];

export function usePeopleYouMayKnow() {
  const viewerId = useSession().viewer?.id ?? null;
  const dismissedIds = useFeedModulePreferencesStore((state) => (viewerId ? state.dismissedSuggestedPeopleByViewer[viewerId] : undefined)) ?? noDismissedPeople;
  const dismissSuggestedPerson = useFeedModulePreferencesStore((state) => state.dismissSuggestedPerson);
  const query = useQuery({
    queryKey: ["suggestions", "peopleYouMayKnow", viewerId],
    queryFn: () => discoveryService.fetchPeopleYouMayKnow(peopleYouMayKnowFetchLimit),
    enabled: viewerId !== null,
    staleTime: 600_000,
  });
  const suggestions = useMemo(() => {
    const dismissed = new Set(dismissedIds);
    return (query.data ?? []).filter((suggestion) => suggestion.user.id !== viewerId && !dismissed.has(suggestion.user.id));
  }, [query.data, dismissedIds, viewerId]);
  const dismiss = useCallback((suggestion: FollowSuggestion) => {
    if (viewerId) dismissSuggestedPerson(viewerId, suggestion.user.id);
  }, [viewerId, dismissSuggestedPerson]);
  return { suggestions, dismiss };
}
