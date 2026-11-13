import { useIsFocused } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, type FlatList, type FlatListProps } from "react-native";
import { useSafeAreaFrame, useSafeAreaInsets } from "react-native-safe-area-context";

import { prefetchUpcomingClipPosters } from "@/screens/clips/clipsPrefetch.util";
import { recordImpressionsForViewableSponsoredItems, sponsoredImpressionViewabilityConfig } from "@/services/ads/adEvents.service";
import { claimAudioFocusForVideoPlayback } from "@/services/clips/videoAudio.service";
import { useVideoAudioStore } from "@/store/videoAudio.store";
import { bottomSafeAreaNotCoveredByTabBar } from "./clipPageLayout.util";
import { clipForPagerAdImpression, clipOrdinalAtOrBeforePagerItem, clipsPagerItemIndexForClip, type ClipsPagerItem } from "@/screens/clips/clipsPagerItems.util";

export const NUMBER_OF_UPCOMING_CLIPS_TO_PRELOAD = 2;
const ACTIVE_CLIP_MINIMUM_VISIBLE_PERCENT = 60;
const PAGE_RESIZE_SETTLE_MS = 600;
type ClipViewabilityConfigCallbackPairs = NonNullable<FlatListProps<ClipsPagerItem>["viewabilityConfigCallbackPairs"]>;
type ClipViewToken = Parameters<NonNullable<ClipViewabilityConfigCallbackPairs[number]["onViewableItemsChanged"]>>[0]["viewableItems"][number];

export function useClipPagerState(items: readonly ClipsPagerItem[]) {
  const insets = useSafeAreaInsets();
  const safeAreaFrame = useSafeAreaFrame();
  const isScreenFocused = useIsFocused();
  const [pageHeight, setPageHeight] = useState(0);
  const clips = useMemo(() => items.flatMap((item) => item.kind === "clip" ? [item.clip] : []), [items]);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [clipIndexToOpenListAt, setClipIndexToOpenListAt] = useState(0);
  const [commentsForClipId, setCommentsForClipId] = useState<string | null>(null);
  const [isAppInForeground, setIsAppInForeground] = useState(AppState.currentState === "active");
  const activePageIndexRef = useRef(0);
  activePageIndexRef.current = activePageIndex;
  const activeItemKeyRef = useRef(items[0]?.key ?? null);
  const previousItemsRef = useRef(items);
  const ignoreViewabilityUntilRef = useRef(0);
  const previousPageHeightRef = useRef(0);
  const clipsListRef = useRef<FlatList<ClipsPagerItem>>(null);
  const isMuted = useVideoAudioStore((state) => state.isMuted);
  const toggleMute = useVideoAudioStore((state) => state.toggleMute);
  const uncoveredBottomInset = bottomSafeAreaNotCoveredByTabBar(insets.bottom, safeAreaFrame.height, pageHeight);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => setIsAppInForeground(state === "active"));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const activeClipOrdinal = clipOrdinalAtOrBeforePagerItem(items, activePageIndex);
    prefetchUpcomingClipPosters(clips, activeClipOrdinal, NUMBER_OF_UPCOMING_CLIPS_TO_PRELOAD + 2);
  }, [clips, items, activePageIndex]);

  const updateActiveClipFromViewableItems = useCallback(({ viewableItems }: { viewableItems: ClipViewToken[] }) => {
    if (Date.now() < ignoreViewabilityUntilRef.current) return;
    const mostVisible = viewableItems.find((token) => token.isViewable && token.index !== null);
    if (mostVisible?.index !== undefined && mostVisible.index !== null) {
      activeItemKeyRef.current = mostVisible.item.key;
      setActivePageIndex(mostVisible.index);
    }
  }, []);

  const viewabilityConfigCallbackPairs = useRef<ClipViewabilityConfigCallbackPairs>([
    { viewabilityConfig: { itemVisiblePercentThreshold: ACTIVE_CLIP_MINIMUM_VISIBLE_PERCENT }, onViewableItemsChanged: updateActiveClipFromViewableItems },
    { viewabilityConfig: sponsoredImpressionViewabilityConfig, onViewableItemsChanged: ({ viewableItems }) => recordImpressionsForViewableSponsoredItems(viewableItems.flatMap((token) => {
      const clip = clipForPagerAdImpression(token.item);
      return clip ? [{ ...token, item: clip }] : [];
    }), "clips") },
  ]).current;

  const keepActiveClipWhenPageHeightChanges = (nextHeight: number) => {
    if (nextHeight === pageHeight) return;
    ignoreViewabilityUntilRef.current = Date.now() + PAGE_RESIZE_SETTLE_MS;
    setPageHeight(nextHeight);
  };

  useEffect(() => {
    const previousHeight = previousPageHeightRef.current;
    previousPageHeightRef.current = pageHeight;
    if (pageHeight === 0 || previousHeight === 0) return;
    const anchoredIndex = activePageIndexRef.current;
    const frame = requestAnimationFrame(() => clipsListRef.current?.scrollToOffset({ offset: anchoredIndex * pageHeight, animated: false }));
    return () => cancelAnimationFrame(frame);
  }, [pageHeight]);

  useEffect(() => {
    const previousItems = previousItemsRef.current;
    previousItemsRef.current = items;
    const activeKey = activeItemKeyRef.current;
    if (!activeKey || pageHeight <= 0) return;

    let nextIndex = items.findIndex((item) => item.key === activeKey);
    if (nextIndex === -1) {
      const previousIndex = previousItems.findIndex((item) => item.key === activeKey);
      const nearbyClipKeys = [
        ...previousItems.slice(previousIndex + 1).filter((item) => item.kind === "clip"),
        ...previousItems.slice(0, previousIndex).reverse().filter((item) => item.kind === "clip"),
      ].map((item) => item.key);
      nextIndex = nearbyClipKeys.map((key) => items.findIndex((item) => item.key === key)).find((index) => index >= 0) ?? -1;
      if (nextIndex >= 0) activeItemKeyRef.current = items[nextIndex]?.key ?? null;
    }
    if (nextIndex < 0 || nextIndex === activePageIndexRef.current) return;

    setActivePageIndex(nextIndex);
    const frame = requestAnimationFrame(() => clipsListRef.current?.scrollToOffset({ offset: nextIndex * pageHeight, animated: false }));
    return () => cancelAnimationFrame(frame);
  }, [items, pageHeight]);

  const isPlaybackAllowed = isScreenFocused && isAppInForeground && commentsForClipId === null && items[activePageIndex]?.kind === "clip";

  useEffect(() => {
    if (!isPlaybackAllowed || isMuted) return;
    claimAudioFocusForVideoPlayback();
  }, [isPlaybackAllowed, isMuted]);

  const openListAtClip = useCallback((index: number) => {
    const pageIndex = clipsPagerItemIndexForClip(items, index);
    if (pageIndex < 0) return;
    activeItemKeyRef.current = items[pageIndex]?.key ?? null;
    setActivePageIndex(pageIndex);
    setClipIndexToOpenListAt(pageIndex);
  }, [items]);

  const scrollToClip = useCallback((index: number) => {
    const pageIndex = clipsPagerItemIndexForClip(items, index);
    if (pageIndex < 0) return;
    clipsListRef.current?.scrollToIndex({ index: pageIndex, animated: true });
  }, [items]);

  const setActiveClipIndex = useCallback((index: number) => {
    const pageIndex = clipsPagerItemIndexForClip(items, index);
    if (pageIndex < 0) return;
    activeItemKeyRef.current = items[pageIndex]?.key ?? null;
    setActivePageIndex(pageIndex);
  }, [items]);

  return {
    insets,
    pageHeight,
    activeClipIndex: activePageIndex,
    setActiveClipIndex,
    clipIndexToOpenListAt,
    openListAtClip,
    scrollToClip,
    commentsForClipId,
    setCommentsForClipId,
    clipsListRef,
    isMuted,
    toggleMute,
    uncoveredBottomInset,
    viewabilityConfigCallbackPairs,
    keepActiveClipWhenPageHeightChanges,
    isPlaybackAllowed,
  };
}

export type ClipPagerState = ReturnType<typeof useClipPagerState>;
