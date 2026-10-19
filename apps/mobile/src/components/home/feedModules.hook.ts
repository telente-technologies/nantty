import { useCallback, useEffect, useMemo } from "react";

import { minimumPeopleToShowCarousel, peopleYouMayKnowPerCarousel, type FeedModuleKind } from "@/constants/feedModules.constant";
import { useAuthStore } from "@/store/auth.store";
import { isSuggestedClipsHiddenFor, useFeedModulePreferencesStore } from "@/store/feedModulePreferences.store";
import { interleaveFeedModules, planFeedModuleSlots, takeChunkForOccurrence } from "@/utils/feedModuleLayout.util";

import { useGetVerifiedFeedCard } from "./getVerifiedFeedCard.hook";
import { usePeopleYouMayKnow } from "./peopleYouMayKnow.hook";
import { useSuggestedClipsStream } from "./suggestedClipsStream.hook";

export function useFeedModules<Post>(posts: readonly Post[]) {
  const viewerId = useAuthStore((state) => (state.status === "signedIn" ? state.user?.id ?? null : null));
  const hiddenUntilByViewer = useFeedModulePreferencesStore((state) => state.suggestedClipsHiddenUntilByViewer);
  const suggestedClipsHidden = isSuggestedClipsHiddenFor(hiddenUntilByViewer, viewerId);
  const suggestedClips = useSuggestedClipsStream({ enabled: !suggestedClipsHidden });
  const people = usePeopleYouMayKnow({ enabled: viewerId !== null });
  const getVerified = useGetVerifiedFeedCard();

  const peopleForCarousel = useCallback((occurrence: number) => takeChunkForOccurrence(people.suggestions, occurrence, peopleYouMayKnowPerCarousel), [people.suggestions]);

  const isModuleEnabled = useCallback((kind: FeedModuleKind) => {
    if (kind === "suggestedClips") return !suggestedClipsHidden;
    if (kind === "peopleYouMayKnow") return viewerId !== null;
    return getVerified.visible;
  }, [suggestedClipsHidden, viewerId, getVerified.visible]);

  const slots = useMemo(() => planFeedModuleSlots({
    postCount: posts.length,
    isModuleEnabled,
    isOccurrenceAvailable: (kind, occurrence) => {
      if (kind === "suggestedClips") return suggestedClips.isRailAvailable(occurrence);
      if (kind === "peopleYouMayKnow") return peopleForCarousel(occurrence).length >= minimumPeopleToShowCarousel;
      return true;
    },
  }), [posts.length, isModuleEnabled, suggestedClips, peopleForCarousel]);

  const wantedRailCount = useMemo(
    () => (suggestedClipsHidden ? 0 : planFeedModuleSlots({ postCount: posts.length, isModuleEnabled: (kind) => kind === "suggestedClips" }).length),
    [suggestedClipsHidden, posts.length],
  );
  const { ensureClipsForRails } = suggestedClips;
  useEffect(() => {
    if (wantedRailCount > 0) ensureClipsForRails(wantedRailCount);
  }, [wantedRailCount, ensureClipsForRails]);

  const rows = useMemo(() => interleaveFeedModules(posts, slots), [posts, slots]);
  return { rows, suggestedClips, people, peopleForCarousel, getVerified };
}

export type FeedModules = ReturnType<typeof useFeedModules>;
