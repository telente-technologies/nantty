import { useCallback, useEffect, useMemo } from "react";

import { minimumPeopleToShowCarousel, peopleYouMayKnowPerCarousel, type FeedModuleKind } from "@/constants/feedModules.constant";
import { useAuthStore } from "@/store/auth.store";
import { isSuggestedClipsHiddenFor, useFeedModulePreferencesStore } from "@/store/feedModulePreferences.store";
import { interleaveFeedModules, planFeedModuleSlots, takeChunkForOccurrence } from "@/utils/feedModuleLayout.util";

import { useGetVerifiedFeedCard } from "./getVerifiedFeedCard.hook";
import { usePeopleYouMayKnow } from "./peopleYouMayKnow.hook";
import { useSuggestedClipsStream } from "./suggestedClipsStream.hook";
import { useProductsYouMightLikeRecommendations } from "./productsYouMightLike";
import { planProductsYouMightLikeSlots, shouldFetchProductsYouMightLike } from "@/utils/productsYouMightLikeLayout.util";

export function useFeedModules<Post extends { readonly sponsored?: unknown }>(posts: readonly Post[], isForYouFeed: boolean) {
  const viewerId = useAuthStore((state) => (state.status === "signedIn" ? state.user?.id ?? null : null));
  const hiddenUntilByViewer = useFeedModulePreferencesStore((state) => state.suggestedClipsHiddenUntilByViewer);
  const suggestedClipsHidden = isSuggestedClipsHiddenFor(hiddenUntilByViewer, viewerId);
  const suggestedClips = useSuggestedClipsStream({ enabled: !suggestedClipsHidden });
  const people = usePeopleYouMayKnow({ enabled: viewerId !== null });
  const organicPostCount = posts.reduce((count, post) => count + (post.sponsored != null && post.sponsored !== false ? 0 : 1), 0);
  const productsYouMightLike = useProductsYouMightLikeRecommendations({
    enabled: shouldFetchProductsYouMightLike(organicPostCount, isForYouFeed),
  });
  const getVerified = useGetVerifiedFeedCard();

  const peopleForCarousel = useCallback((occurrence: number) => takeChunkForOccurrence(people.suggestions, occurrence, peopleYouMayKnowPerCarousel), [people.suggestions]);

  const isModuleEnabled = useCallback((kind: FeedModuleKind) => {
    if (kind === "suggestedClips") return !suggestedClipsHidden;
    if (kind === "peopleYouMayKnow") return viewerId !== null;
    if (kind === "productsYouMightLike") return false;
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
  const productSlots = useMemo(() => planProductsYouMightLikeSlots(
    posts,
    slots,
    (productsYouMightLike.data?.products.length ?? 0) > 0,
    isForYouFeed,
  ), [posts, slots, productsYouMightLike.data, isForYouFeed]);
  const allSlots = useMemo(
    () => [...slots, ...productSlots].sort((left, right) => left.afterPostCount - right.afterPostCount),
    [slots, productSlots],
  );

  const wantedRailCount = useMemo(
    () => (suggestedClipsHidden ? 0 : planFeedModuleSlots({ postCount: posts.length, isModuleEnabled: (kind) => kind === "suggestedClips" }).length),
    [suggestedClipsHidden, posts.length],
  );
  const { ensureClipsForRails } = suggestedClips;
  useEffect(() => {
    if (wantedRailCount > 0) ensureClipsForRails(wantedRailCount);
  }, [wantedRailCount, ensureClipsForRails]);

  const rows = useMemo(() => interleaveFeedModules(posts, allSlots), [posts, allSlots]);
  return { rows, suggestedClips, people, peopleForCarousel, productsYouMightLike, getVerified };
}

export type FeedModules = ReturnType<typeof useFeedModules>;
