import { useCallback, useRef } from "react";
import type { ViewToken, ViewabilityConfigCallbackPairs } from "react-native";
import { create } from "zustand";

import { recordImpressionsForViewableSponsoredItems, sponsoredImpressionViewabilityConfig } from "@/services/adEvents.service";
import type { AdPlacement, ID } from "@/types";

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
  return useVisibleFeedItemsStore((state) => !state.isListReportingVisibility || state.visibleItemIds.has(itemId));
}

const MEDIA_AUTOPLAY_MINIMUM_VISIBLE_PERCENT = 60;

export function useFeedViewabilityTracking(placement: AdPlacement): ViewabilityConfigCallbackPairs {
  const replaceVisibleItemIds = useVisibleFeedItemsStore((state) => state.replaceVisibleItemIds);
  const updateAutoplayVisibility = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) =>
      replaceVisibleItemIds(viewableItems.map((token) => (token.item as { id?: ID } | undefined)?.id).filter((id): id is ID => !!id)),
    [replaceVisibleItemIds],
  );
  const pairs = useRef<ViewabilityConfigCallbackPairs>([
    { viewabilityConfig: { itemVisiblePercentThreshold: MEDIA_AUTOPLAY_MINIMUM_VISIBLE_PERCENT }, onViewableItemsChanged: updateAutoplayVisibility },
    {
      viewabilityConfig: sponsoredImpressionViewabilityConfig,
      onViewableItemsChanged: ({ viewableItems }) => recordImpressionsForViewableSponsoredItems(viewableItems, placement),
    },
  ]);
  return pairs.current;
}
