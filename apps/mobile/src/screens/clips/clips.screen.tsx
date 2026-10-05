import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useIsFocused, type CompositeScreenProps } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, FlatList, Share, StyleSheet, View, type ViewToken, type ViewabilityConfigCallbackPairs } from "react-native";
import { useShareToChat } from "@/components/chatSafety/shareToChat.hook";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ClipCommentsSheet } from "@/components/clips/clipCommentsSheet";
import { ClipPage, type ClipEngagement } from "@/components/clips/clipPage";
import { ClipsFeedState } from "@/components/clips/clipsFeedState";
import { ClipsHeader } from "@/components/clips/clipsHeader";
import { rememberClipGestureTipsSeen, shouldShowClipGestureTips } from "@/components/clips/clipGestureTipsSeen.util";
import { GestureTipsOverlay } from "@/components/clips/gestureTipsOverlay";
import { colors } from "@/constants/colors.constant";
import type { MainStackParamList, MainTabParamList } from "@/navigation/navigation.types";
import { recordImpressionsForViewableSponsoredItems, sponsoredImpressionViewabilityConfig } from "@/services/adEvents.service";
import { clipsService } from "@/services/clips.service";
import { claimAudioFocusForVideoPlayback } from "@/services/videoAudio.service";
import { useOpenUserProfile } from "@/hooks/useOpenUserProfile.hook";
import { useAuthStore } from "@/store/auth.store";
import { useVideoAudioStore } from "@/store/videoAudio.store";
import type { Clip, ClipsFeedTab } from "@/types";

import { prefetchUpcomingClipPosters } from "./clipsPrefetch.util";
import { requireAuthThen } from "@/utils/requireAuth.util";
import { webAppLinks } from "@/config/webAppLinks.config";

type ClipsScreenProps = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, "Clips">,
  NativeStackScreenProps<MainStackParamList>
>;

const NUMBER_OF_UPCOMING_CLIPS_TO_PRELOAD = 2;
const ACTIVE_CLIP_MINIMUM_VISIBLE_PERCENT = 60;

export function ClipsScreen({ navigation, route }: ClipsScreenProps) {
  const requestedStartClipId = route.params?.startId;
  const requestedCommentId = route.params?.commentId;
  const [highlightedCommentId, setHighlightedCommentId] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const isScreenFocused = useIsFocused();
  const myAvatarUrl = useAuthStore((s) => s.user?.avatarUrl ?? null);
  const myUserId = useAuthStore((s) => s.user?.id ?? null);
  const openUserProfile = useOpenUserProfile();
  const [tab, setTab] = useState<ClipsFeedTab>("forYou");
  const [pageHeight, setPageHeight] = useState(0);
  const [activeClipIndex, setActiveClipIndex] = useState(0);
  const [isAppInForeground, setIsAppInForeground] = useState(AppState.currentState === "active");
  const isMuted = useVideoAudioStore((state) => state.isMuted);
  const toggleMute = useVideoAudioStore((state) => state.toggleMute);
  const [engagementByClipId, setEngagementByClipId] = useState<Record<string, ClipEngagement>>({});
  const [commentsForClipId, setCommentsForClipId] = useState<string | null>(null);
  const [showGestureTips, setShowGestureTips] = useState(() => shouldShowClipGestureTips(myUserId));
  const clipsListRef = useRef<FlatList<Clip>>(null);
  const [clipIndexToOpenListAt, setClipIndexToOpenListAt] = useState(0);

  const clipsFeed = useInfiniteQuery({
    queryKey: ["clips", tab],
    queryFn: ({ pageParam }) => clipsService.fetchClipsFeed(tab, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const clips = useMemo(() => clipsFeed.data?.pages.flatMap((page) => page.data) ?? [], [clipsFeed.data]);

  useEffect(() => {
    navigation.setOptions({ tabBarStyle: { display: "none" } });
  }, [navigation]);

  useEffect(() => {
    if (!requestedStartClipId || pageHeight === 0 || !clipsFeed.isSuccess) return;
    if (tab !== "forYou") {
      setTab("forYou");
      return;
    }
    const requestedClipIndex = clips.findIndex((clip) => clip.id === requestedStartClipId);
    if (requestedClipIndex === -1) {
      if (clipsFeed.hasNextPage && !clipsFeed.isFetchingNextPage) clipsFeed.fetchNextPage().catch(() => undefined);
      if (!clipsFeed.hasNextPage) navigation.setParams({ startId: undefined });
      return;
    }
    setActiveClipIndex(requestedClipIndex);
    setClipIndexToOpenListAt(requestedClipIndex);
    if (requestedCommentId) {
      setHighlightedCommentId(requestedCommentId);
      setCommentsForClipId(requestedStartClipId);
    }
    navigation.setParams({ startId: undefined, commentId: undefined });
  }, [requestedStartClipId, requestedCommentId, pageHeight, clips, tab, clipsFeed, navigation]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => setIsAppInForeground(state === "active"));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    prefetchUpcomingClipPosters(clips, activeClipIndex, NUMBER_OF_UPCOMING_CLIPS_TO_PRELOAD + 2);
  }, [clips, activeClipIndex]);

  const switchFeedTabAndScrollToTop = (nextTab: ClipsFeedTab) => {
    setTab(nextTab);
    setActiveClipIndex(0);
    setClipIndexToOpenListAt(0);
    clipsListRef.current?.scrollToOffset({ offset: 0, animated: false });
  };

  const updateActiveClipFromViewableItems = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const mostVisible = viewableItems.find((token) => token.isViewable && token.index !== null);
    if (mostVisible?.index !== undefined && mostVisible.index !== null) setActiveClipIndex(mostVisible.index);
  }, []);

  const viewabilityConfigCallbackPairs = useRef<ViewabilityConfigCallbackPairs>([
    { viewabilityConfig: { itemVisiblePercentThreshold: ACTIVE_CLIP_MINIMUM_VISIBLE_PERCENT }, onViewableItemsChanged: updateActiveClipFromViewableItems },
    {
      viewabilityConfig: sponsoredImpressionViewabilityConfig,
      onViewableItemsChanged: ({ viewableItems }) => recordImpressionsForViewableSponsoredItems(viewableItems, "clips"),
    },
  ]).current;

  const engagementFor = (clip: Clip): ClipEngagement =>
    engagementByClipId[clip.id] ?? { liked: clip.liked, likes: clip.likes, isFollowing: clip.isFollowingAuthor };

  const updateEngagement = (clip: Clip, change: (current: ClipEngagement) => ClipEngagement) =>
    setEngagementByClipId((all) => ({ ...all, [clip.id]: change(all[clip.id] ?? engagementFor(clip)) }));

  const applyLikeToggleOnClip = (clip: Clip) => {
    const wasLiked = engagementFor(clip).liked;
    updateEngagement(clip, (e) => ({ ...e, liked: !wasLiked, likes: e.likes + (wasLiked ? -1 : 1) }));
    (wasLiked ? clipsService.unlikeClip(clip.id) : clipsService.likeClip(clip.id)).catch(() =>
      updateEngagement(clip, (e) => ({ ...e, liked: wasLiked, likes: e.likes + (wasLiked ? 1 : -1) })),
    );
  };

  const toggleLikeOnClip = (clip: Clip) => requireAuthThen(() => applyLikeToggleOnClip(clip), undefined, "like clips");

  const likeClipWithDoubleTap = (clip: Clip) => {
    if (!engagementFor(clip).liked) toggleLikeOnClip(clip);
  };

  const applyFollowOnClipAuthor = (clip: Clip) => {
    const wasFollowing = engagementFor(clip).isFollowing;
    updateEngagement(clip, (e) => ({ ...e, isFollowing: !wasFollowing }));
    if (!wasFollowing) clipsService.followClipAuthor(clip.author.id).catch(() => updateEngagement(clip, (e) => ({ ...e, isFollowing: false })));
  };

  const toggleFollowOnClipAuthor = (clip: Clip) => requireAuthThen(() => applyFollowOnClipAuthor(clip), undefined, "follow creators");

  const { offerSendInChat, sendInChatElement } = useShareToChat();

  const shareClipLink = async (clip: Clip) => {
    await Share.share({ message: webAppLinks.clip(clip.id) }).catch(() => undefined);
    clipsService.recordClipShare(clip.id).catch(() => undefined);
  };

  useEffect(() => {
    if (shouldShowClipGestureTips(myUserId)) setShowGestureTips(true);
  }, [myUserId]);

  const dismissGestureTips = () => {
    rememberClipGestureTipsSeen(myUserId);
    setShowGestureTips(false);
  };

  const isPlaybackAllowed = isScreenFocused && isAppInForeground && commentsForClipId === null;

  useEffect(() => {
    if (!isPlaybackAllowed || isMuted) return;
    claimAudioFocusForVideoPlayback();
  }, [isPlaybackAllowed, isMuted]);

  return (
    <View style={styles.root} onLayout={(e) => setPageHeight(Math.round(e.nativeEvent.layout.height))}>
      {sendInChatElement}
      {pageHeight > 0 ? (
        <FlatList
          key={`clips-list-opened-at-${clipIndexToOpenListAt}`}
          ref={clipsListRef}
          initialScrollIndex={clipIndexToOpenListAt}
          data={clips}
          keyExtractor={(c) => c.id}
          pagingEnabled
          snapToInterval={pageHeight}
          snapToAlignment="start"
          decelerationRate="fast"
          disableIntervalMomentum
          showsVerticalScrollIndicator={false}
          getItemLayout={(_, index) => ({ length: pageHeight, offset: pageHeight * index, index })}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          windowSize={3}
          removeClippedSubviews
          viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs}
          onEndReachedThreshold={2}
          onEndReached={() => {
            if (clipsFeed.hasNextPage && !clipsFeed.isFetchingNextPage) clipsFeed.fetchNextPage().catch(() => undefined);
          }}
          extraData={{ activeClipIndex, isMuted, isPlaybackAllowed, engagementByClipId }}
          renderItem={({ item, index }) => (
            <ClipPage
              clip={item}
              height={pageHeight}
              isActive={isPlaybackAllowed && index === activeClipIndex}
              shouldMountVideoPlayer={index >= activeClipIndex - 1 && index <= activeClipIndex + NUMBER_OF_UPCOMING_CLIPS_TO_PRELOAD}
              isMuted={isMuted}
              topInset={insets.top}
              bottomInset={insets.bottom}
              engagement={engagementFor(item)}
              myAvatarUrl={myAvatarUrl}
              onToggleMute={toggleMute}
              onToggleLike={() => toggleLikeOnClip(item)}
              onLikeByDoubleTap={() => likeClipWithDoubleTap(item)}
              onToggleFollow={() => toggleFollowOnClipAuthor(item)}
              onOpenComments={() => setCommentsForClipId(item.id)}
              onShare={() => offerSendInChat({ kind: "clip", id: item.id }, () => shareClipLink(item))}
              onPressAuthor={() => openUserProfile(item.author.id)}
              onOpenPromotedLive={(liveSessionId) => navigation.navigate("Live", { liveId: liveSessionId })}
            />
          )}
        />
      ) : null}
      {clips.length === 0 ? (
        <ClipsFeedState
          tab={tab}
          isPending={clipsFeed.isPending}
          isError={clipsFeed.isError}
          isRefetching={clipsFeed.isRefetching}
          onRetry={() => clipsFeed.refetch()}
          onExploreForYou={() => switchFeedTabAndScrollToTop("forYou")}
        />
      ) : null}
      <View style={[styles.header, { paddingTop: insets.top }]} pointerEvents="box-none">
        <ClipsHeader
          tab={tab}
          onChangeTab={switchFeedTabAndScrollToTop}
          onBack={() => navigation.navigate("Home")}
          onSearch={() => navigation.navigate("Search", { scope: "global" })}
          foregroundColor={colors.white}
        />
      </View>
      {showGestureTips && clipsFeed.isSuccess ? <GestureTipsOverlay onDismiss={dismissGestureTips} /> : null}
      <ClipCommentsSheet postId={commentsForClipId} clip={clips.find((clip) => clip.id === commentsForClipId) ?? null} highlightCommentId={highlightedCommentId} myAvatarUrl={myAvatarUrl} onClose={() => {
        setCommentsForClipId(null);
        setHighlightedCommentId(null);
      }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  header: { position: "absolute", top: 0, left: 0, right: 0 },
});
