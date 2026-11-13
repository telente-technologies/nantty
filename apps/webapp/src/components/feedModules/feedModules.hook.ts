"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { minimumPeopleToShowCarousel, peopleYouMayKnowPerCarousel, type FeedModuleKind } from "@/config/feedModules.config";
import { useProductInteraction } from "@/components/commerce/useProductInteraction.hook";
import { useSession } from "@/components/providers/sessionProvider";
import { productsService } from "@/services/products.service";
import { isSuggestedClipsHiddenFor, useFeedModulePreferencesStore } from "@/store/feedModulePreferences.store";
import { interleaveFeedModules, planFeedModuleSlots, planProductsYouMightLikeSlots, shouldFetchProductsYouMightLike, takeChunkForOccurrence } from "@/utils/feedModuleLayout.util";

import { useGetVerifiedFeedCard } from "./getVerifiedFeedCard.hook";
import { usePeopleYouMayKnow } from "./peopleYouMayKnow.hook";
import { useSuggestedClipsStream } from "./suggestedClipsStream.hook";

export function useFeedModules<Post extends { readonly sponsored?: unknown }>(posts: readonly Post[], isForYouFeed: boolean) {
  const viewerId = useSession().viewer?.id ?? null;
  const { track: trackInteraction } = useProductInteraction();
  const hiddenUntilByViewer = useFeedModulePreferencesStore((state) => state.suggestedClipsHiddenUntilByViewer);
  const suggestedClipsHidden = isSuggestedClipsHiddenFor(hiddenUntilByViewer, viewerId);
  const suggestedClips = useSuggestedClipsStream({ enabled: !suggestedClipsHidden });
  const people = usePeopleYouMayKnow();
  const getVerified = useGetVerifiedFeedCard();
  const organicPostCount = useMemo(() => posts.filter((post) => post.sponsored == null || post.sponsored === false).length, [posts]);
  const recommendations = useQuery({
    queryKey: ["mart", "recommendations", "for_you", viewerId ?? "guest"],
    queryFn: () => productsService.fetchProductsYouMightLike("for_you"),
    enabled: shouldFetchProductsYouMightLike(organicPostCount, isForYouFeed),
    staleTime: 5 * 60_000,
    retry: false,
  });

  const peopleForCarousel = useCallback((occurrence: number) => takeChunkForOccurrence(people.suggestions, occurrence, peopleYouMayKnowPerCarousel), [people.suggestions]);

  const isModuleEnabled = useCallback((kind: FeedModuleKind) => {
    if (kind === "suggestedClips") return !suggestedClipsHidden;
    if (kind === "peopleYouMayKnow") return viewerId !== null;
    if (kind === "productsYouMightLike") return false;
    return getVerified.visible;
  }, [suggestedClipsHidden, viewerId, getVerified.visible]);

  const baseSlots = useMemo(() => planFeedModuleSlots({
    postCount: posts.length,
    isModuleEnabled,
    isOccurrenceAvailable: (kind, occurrence) => {
      if (kind === "suggestedClips") return suggestedClips.isRailAvailable(occurrence);
      if (kind === "peopleYouMayKnow") return peopleForCarousel(occurrence).length >= minimumPeopleToShowCarousel;
      return true;
    },
  }), [posts.length, isModuleEnabled, suggestedClips, peopleForCarousel]);
  const productSlots = useMemo(() => planProductsYouMightLikeSlots(posts, baseSlots, (recommendations.data?.products.length ?? 0) > 0, isForYouFeed), [posts, baseSlots, recommendations.data?.products.length, isForYouFeed]);
  const slots = useMemo(() => [...baseSlots, ...productSlots].sort((left, right) => left.afterPostCount - right.afterPostCount), [baseSlots, productSlots]);

  const wantedRailCount = useMemo(
    () => (suggestedClipsHidden ? 0 : planFeedModuleSlots({ postCount: posts.length, isModuleEnabled: (kind) => kind === "suggestedClips" }).length),
    [suggestedClipsHidden, posts.length],
  );
  const { ensureClipsForRails } = suggestedClips;
  useEffect(() => {
    if (wantedRailCount > 0) ensureClipsForRails(wantedRailCount);
  }, [wantedRailCount, ensureClipsForRails]);

  const rows = useMemo(() => interleaveFeedModules(posts, slots), [posts, slots]);
  return { rows, suggestedClips, people, peopleForCarousel, getVerified, recommendations, trackInteraction };
}

export type FeedModules = ReturnType<typeof useFeedModules>;
