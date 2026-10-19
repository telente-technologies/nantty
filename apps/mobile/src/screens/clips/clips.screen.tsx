import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { ClipCommentsSheet } from "@/components/clips/clipCommentsSheet";
import { ClipPagerList } from "@/components/clips/clipPagerList";
import { useClipPagerState } from "@/components/clips/clipPagerState.hook";
import { ClipsFeedState } from "@/components/clips/clipsFeedState";
import { ClipsHeader } from "@/components/clips/clipsHeader";
import { rememberClipGestureTipsSeen, shouldShowClipGestureTips } from "@/components/clips/clipGestureTipsSeen.util";
import { GestureTipsOverlay } from "@/components/clips/gestureTipsOverlay";
import { colors } from "@/constants/colors.constant";
import type { MainStackParamList, MainTabParamList } from "@/navigation/navigation.types";
import { clipsService } from "@/services/clips/clips.service";
import { useAuthStore } from "@/store/auth.store";
import { isCommentsCursorExpiredError } from "@/hooks/useRestartCommentsOnExpiredCursor.hook";
import { requireAuthThen } from "@/utils/requireAuth.util";
import type { ClipsFeedTab } from "@/types";

type ClipsScreenProps = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, "Clips">,
  NativeStackScreenProps<MainStackParamList>
>;

export function ClipsScreen({ navigation, route }: ClipsScreenProps) {
  const requestedStartClipId = route.params?.startId;
  const requestedCommentId = route.params?.commentId;
  const [highlightedCommentId, setHighlightedCommentId] = useState<string | null>(null);
  const myAvatarUrl = useAuthStore((s) => s.user?.avatarUrl ?? null);
  const myUserId = useAuthStore((s) => s.user?.id ?? null);
  const [tab, setTab] = useState<ClipsFeedTab>("forYou");
  const queryClient = useQueryClient();
  const [showGestureTips, setShowGestureTips] = useState(() => shouldShowClipGestureTips(myUserId));

  const clipsFeed = useInfiniteQuery({
    queryKey: ["clips", tab],
    queryFn: ({ pageParam }) => clipsService.fetchClipsFeed(tab, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const clips = useMemo(() => clipsFeed.data?.pages.flatMap((page) => page.data) ?? [], [clipsFeed.data]);
  const pager = useClipPagerState(clips);
  const { pageHeight, openListAtClip, setCommentsForClipId, commentsForClipId } = pager;
  const clipsCursorExpired = isCommentsCursorExpiredError(clipsFeed.error);
  useEffect(() => {
    if (!clipsCursorExpired) return;
    pager.setActiveClipIndex(0);
    void queryClient.resetQueries({ queryKey: ["clips", tab], exact: true });
  }, [clipsCursorExpired, queryClient, tab, pager.setActiveClipIndex]);

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
    openListAtClip(requestedClipIndex);
    if (requestedCommentId) {
      setHighlightedCommentId(requestedCommentId);
      setCommentsForClipId(requestedStartClipId);
    }
    navigation.setParams({ startId: undefined, commentId: undefined });
  }, [requestedStartClipId, requestedCommentId, pageHeight, clips, tab, clipsFeed, navigation, openListAtClip, setCommentsForClipId]);

  const showFeedTabFromTop = (nextTab: ClipsFeedTab) => {
    setTab(nextTab);
    openListAtClip(0);
    pager.clipsListRef.current?.scrollToOffset({ offset: 0, animated: false });
  };
  const switchFeedTabAndScrollToTop = (nextTab: ClipsFeedTab) => {
    if (nextTab === "following") requireAuthThen(() => showFeedTabFromTop("following"), undefined, "see clips from people you follow");
    else showFeedTabFromTop(nextTab);
  };
  const isSignedIn = useAuthStore((s) => s.status === "signedIn");
  useEffect(() => {
    if (!isSignedIn && tab === "following") setTab("forYou");
  }, [isSignedIn, tab]);

  useEffect(() => {
    if (shouldShowClipGestureTips(myUserId)) setShowGestureTips(true);
  }, [myUserId]);

  const dismissGestureTips = () => {
    rememberClipGestureTipsSeen(myUserId);
    setShowGestureTips(false);
  };

  return (
    <View style={styles.root} onLayout={(e) => pager.keepActiveClipWhenPageHeightChanges(e.nativeEvent.layout.height)}>
      <ClipPagerList
        pager={pager}
        clips={clips}
        listKeyPrefix="clips-list"
        onEndReached={() => {
          if (clipsFeed.hasNextPage && !clipsFeed.isFetchingNextPage) clipsFeed.fetchNextPage().catch(() => undefined);
        }}
      />
      {clips.length === 0 ? (
        <ClipsFeedState
          tab={tab}
          isPending={clipsFeed.isPending}
          isError={clipsFeed.isError}
          isRefetching={clipsFeed.isRefetching}
          onRetry={() => clipsFeed.refetch()}
          onExploreForYou={() => switchFeedTabAndScrollToTop("forYou")}
          onFollowedCreator={() => void queryClient.invalidateQueries({ queryKey: ["clips", "following"] })}
        />
      ) : null}
      <View style={[styles.header, { paddingTop: pager.insets.top }]} pointerEvents="box-none">
        <ClipsHeader
          tab={tab}
          onChangeTab={switchFeedTabAndScrollToTop}
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
  header: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, elevation: 10 },
});
