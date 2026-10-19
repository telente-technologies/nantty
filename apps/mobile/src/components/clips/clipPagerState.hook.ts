import { useIsFocused } from "@react-navigation/native";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type FlatList, type ViewToken, type ViewabilityConfigCallbackPairs } from "react-native";
import { useSafeAreaFrame, useSafeAreaInsets } from "react-native-safe-area-context";

import { prefetchUpcomingClipPosters } from "@/screens/clips/clipsPrefetch.util";
import { recordImpressionsForViewableSponsoredItems, sponsoredImpressionViewabilityConfig } from "@/services/ads/adEvents.service";
import { claimAudioFocusForVideoPlayback } from "@/services/clips/videoAudio.service";
import { useVideoAudioStore } from "@/store/videoAudio.store";
import type { Clip } from "@/types";

import { bottomSafeAreaNotCoveredByTabBar } from "./clipPageLayout.util";

export const NUMBER_OF_UPCOMING_CLIPS_TO_PRELOAD = 2;
const ACTIVE_CLIP_MINIMUM_VISIBLE_PERCENT = 60;
const PAGE_RESIZE_SETTLE_MS = 600;

export function useClipPagerState(clips: readonly Clip[]) {
  const insets = useSafeAreaInsets();
  const safeAreaFrame = useSafeAreaFrame();
  const isScreenFocused = useIsFocused();
  const [pageHeight, setPageHeight] = useState(0);
  const [activeClipIndex, setActiveClipIndex] = useState(0);
  const [clipIndexToOpenListAt, setClipIndexToOpenListAt] = useState(0);
  const [commentsForClipId, setCommentsForClipId] = useState<string | null>(null);
  const [isAppInForeground, setIsAppInForeground] = useState(AppState.currentState === "active");
  const activeClipIndexRef = useRef(0);
  activeClipIndexRef.current = activeClipIndex;
  const ignoreViewabilityUntilRef = useRef(0);
  const previousPageHeightRef = useRef(0);
  const clipsListRef = useRef<FlatList<Clip>>(null);
  const isMuted = useVideoAudioStore((state) => state.isMuted);
  const toggleMute = useVideoAudioStore((state) => state.toggleMute);
  const uncoveredBottomInset = bottomSafeAreaNotCoveredByTabBar(insets.bottom, safeAreaFrame.height, pageHeight);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => setIsAppInForeground(state === "active"));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    prefetchUpcomingClipPosters(clips, activeClipIndex, NUMBER_OF_UPCOMING_CLIPS_TO_PRELOAD + 2);
  }, [clips, activeClipIndex]);

  const updateActiveClipFromViewableItems = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (Date.now() < ignoreViewabilityUntilRef.current) return;
    const mostVisible = viewableItems.find((token) => token.isViewable && token.index !== null);
    if (mostVisible?.index !== undefined && mostVisible.index !== null) setActiveClipIndex(mostVisible.index);
  }, []);

  const viewabilityConfigCallbackPairs = useRef<ViewabilityConfigCallbackPairs>([
    { viewabilityConfig: { itemVisiblePercentThreshold: ACTIVE_CLIP_MINIMUM_VISIBLE_PERCENT }, onViewableItemsChanged: updateActiveClipFromViewableItems },
    { viewabilityConfig: sponsoredImpressionViewabilityConfig, onViewableItemsChanged: ({ viewableItems }) => recordImpressionsForViewableSponsoredItems(viewableItems, "clips") },
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
    const anchoredIndex = activeClipIndexRef.current;
    const frame = requestAnimationFrame(() => clipsListRef.current?.scrollToOffset({ offset: anchoredIndex * pageHeight, animated: false }));
    return () => cancelAnimationFrame(frame);
  }, [pageHeight]);

  const isPlaybackAllowed = isScreenFocused && isAppInForeground && commentsForClipId === null;

  useEffect(() => {
    if (!isPlaybackAllowed || isMuted) return;
    claimAudioFocusForVideoPlayback();
  }, [isPlaybackAllowed, isMuted]);

  const openListAtClip = useCallback((index: number) => {
    setActiveClipIndex(index);
    setClipIndexToOpenListAt(index);
  }, []);

  const scrollToClip = useCallback((index: number) => {
    if (index < 0 || index >= clips.length) return;
    clipsListRef.current?.scrollToIndex({ index, animated: true });
  }, [clips.length]);

  return {
    insets,
    pageHeight,
    activeClipIndex,
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
