import { useCallback, useEffect, useRef } from "react";
import type { FlatListProps } from "react-native";
import { create } from "zustand";

import { prefetchImagesToDiskCache } from "@/cache/cachedImage";
import { useIsHomeSectionOnScreen } from "@/components/home/homeSectionVisibility.context";
import { recordImpressionsForViewableSponsoredItems, sponsoredImpressionViewabilityConfig } from "@/services/ads/adEvents.service";
import type { AdPlacement, ID, Media } from "@/types";

interface VisibleFeedItemsState {
  readonly isListReportingVisibility: boolean;
  readonly visibleItemIds: ReadonlySet<ID>;
  readonly replaceVisibleItemIds: (ids: readonly ID[]) => void;
  readonly stopReportingVisibility: () => void;
}

export const useVisibleFeedItemsStore = create<VisibleFeedItemsState>((set) => ({
  isListReportingVisibility: false,
  visibleItemIds: new Set(),
  replaceVisibleItemIds: (ids) => set({ isListReportingVisibility: true, visibleItemIds: new Set(ids) }),
  stopReportingVisibility: () => set({ isListReportingVisibility: false, visibleItemIds: new Set() }),
}));

export function useIsFeedItemVisibleForAutoplay(itemId: ID) {
  const isSectionOnScreen = useIsHomeSectionOnScreen();
  const isVisibleInList = useVisibleFeedItemsStore((state) => !state.isListReportingVisibility || state.visibleItemIds.has(itemId));
  return isSectionOnScreen && isVisibleInList;
}

const MEDIA_AUTOPLAY_MINIMUM_VISIBLE_PERCENT = 60;
const NUMBER_OF_UPCOMING_ITEMS_TO_PREFETCH = 3;

type FeedItemWithMedia = { readonly id?: ID; readonly media?: readonly Media[] };
type FeedViewabilityConfigCallbackPairs = NonNullable<FlatListProps<FeedItemWithMedia>["viewabilityConfigCallbackPairs"]>;
type FeedViewToken = Parameters<NonNullable<FeedViewabilityConfigCallbackPairs[number]["onViewableItemsChanged"]>>[0]["viewableItems"][number];

export function useFeedViewabilityTracking(
  placement: AdPlacement,
  allFeedItems: readonly FeedItemWithMedia[] = [],
): FeedViewabilityConfigCallbackPairs {
  const replaceVisibleItemIds = useVisibleFeedItemsStore((state) => state.replaceVisibleItemIds);
  const stopReportingVisibility = useVisibleFeedItemsStore((state) => state.stopReportingVisibility);
  useEffect(() => stopReportingVisibility, [stopReportingVisibility]);
  const latestFeedItems = useRef(allFeedItems);
  latestFeedItems.current = allFeedItems;
  const updateAutoplayVisibilityAndPrefetchUpcomingImages = useCallback(
    ({ viewableItems }: { viewableItems: FeedViewToken[] }) => {
      replaceVisibleItemIds(viewableItems.map((token) => (token.item as FeedItemWithMedia | undefined)?.id).filter((id): id is ID => !!id));
      const lastVisibleIndex = Math.max(-1, ...viewableItems.map((token) => token.index ?? -1));
      const upcomingItems = latestFeedItems.current.slice(lastVisibleIndex + 1, lastVisibleIndex + 1 + NUMBER_OF_UPCOMING_ITEMS_TO_PREFETCH);
      prefetchImagesToDiskCache(upcomingItems.flatMap((item) => (item.media ?? []).map((media) => (media.type === "image" ? media.url : media.posterUrl))));
    },
    [replaceVisibleItemIds],
  );
  const pairs = useRef<FeedViewabilityConfigCallbackPairs>([
    { viewabilityConfig: { itemVisiblePercentThreshold: MEDIA_AUTOPLAY_MINIMUM_VISIBLE_PERCENT }, onViewableItemsChanged: updateAutoplayVisibilityAndPrefetchUpcomingImages },
    {
      viewabilityConfig: sponsoredImpressionViewabilityConfig,
      onViewableItemsChanged: ({ viewableItems }) => recordImpressionsForViewableSponsoredItems(viewableItems, placement),
    },
  ]);
  return pairs.current;
}
