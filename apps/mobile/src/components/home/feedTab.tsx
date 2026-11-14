import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { useMemo, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";

import { GuestFeedBanner } from "@/components/auth/guestFeedBanner";
import { useShareToChat } from "@/components/chatSafety/shareToChat.hook";
import { PostCard } from "@/components/feed/postCard";
import { ReshareSheet } from "@/components/feed/reshareSheet";
import { BrandLoader } from "@/components/ui/brandLoader";
import { makeThemedStyles } from "@/theme";
import { feedQueryKeyPrefix, usePostInteractions } from "@/hooks/usePostInteractions.hook";
import { feedsService } from "@/services/feed/feeds.service";
import type { Post, ProductSummary } from "@/types";
import { requireAuthThen } from "@/utils/requireAuth.util";

import { attributionSourceForPostKind, type SaleAttribution } from "@/utils/saleAttribution.util";
import { feedModuleRowKey } from "@/utils/feedModuleLayout.util";

import { PostProductsFlow } from "./postProductsFlow";
import { FeedModuleRow } from "./feedModuleRow";
import { useFeedModules } from "./feedModules.hook";
import { SuggestedClipsOptionsSheet } from "./suggestedClipsOptionsSheet";
import { TopicFilterRow } from "./topicFilterRow";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { EmptyState } from "@/components/ui/emptyState";
import { ErrorState } from "@/components/ui/errorState";
import { usePullToRefresh } from "@/components/ui/pullToRefresh.hook";
import { spacing } from "@/constants/spacing.constant";
import { createFeedProductAdSessionId, productAdSponsoredPlacement, productAdsService, usableFeedProductAd } from "@/services/ads/productAds.service";
import { useAuthStore } from "@/store/auth.store";
import { useFeedViewabilityTracking } from "@/components/feed/feedVisibility.hook";
import { FeedProductAdCard } from "@/components/ads/feedProductAdCard";
import { insertFeedProductAd, shouldDecideFeedProductAd } from "@/components/ads/feedProductAdRows.util";
import { StoryTray } from "@/components/chat/storyTray";
import { liveService } from "@/services/live/live.service";
import { storiesService } from "@/services/clips/stories.service";

type FeedMode = "for-you" | "following";
export function FeedTab() {
  const styles = useStyles();
  const navigation = useNavigation();
  const viewerId = useAuthStore((state) => state.status === "signedIn" ? state.user?.id ?? null : null);
  const myAvatarUrl = useAuthStore((state) => state.user?.avatarUrl ?? null);
  const [feedMode, setFeedMode] = useState<FeedMode>("for-you");
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [openPostProducts, setOpenPostProducts] = useState<{ readonly products: readonly ProductSummary[]; readonly attribution: SaleAttribution } | null>(null);
  const [reshareTarget, setReshareTarget] = useState<Post | null>(null);
  const { togglePostLike, followPostAuthor, sharePost } = usePostInteractions();
  const { offerSendInChat, sendInChatElement } = useShareToChat();

  const topics = useQuery({ queryKey: ["topics", "mine"], queryFn: feedsService.fetchMyFollowedTopics });
  const storyTray = useQuery({ queryKey: ["story-tray"], queryFn: storiesService.fetchStoryTray, enabled: viewerId !== null });
  const suggestedLives = useQuery({ queryKey: ["suggested-lives"], queryFn: liveService.fetchSuggestedLives, enabled: viewerId !== null });
  const [railOptionsClipIds, setRailOptionsClipIds] = useState<readonly string[] | null>(null);
  const feed = useInfiniteQuery({
    queryKey: [...feedQueryKeyPrefix, feedMode, selectedTopicId],
    queryFn: ({ pageParam }) =>
      feedMode === "following"
        ? feedsService.fetchFollowingFeedPage(pageParam)
        : feedsService.fetchForYouFeedPage(selectedTopicId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
  const refreshControl = usePullToRefresh(feed.refetch);

  const posts = useMemo<Post[]>(() => {
    const seenPostIds = new Set<string>();
    const unique: Post[] = [];
    for (const page of feed.data?.pages ?? []) {
      for (const post of page.data) {
        if (seenPostIds.has(post.id)) continue;
        seenPostIds.add(post.id);
        unique.push(post);
      }
    }
    return unique;
  }, [feed.data]);
  const modules = useFeedModules(posts, feedMode === "for-you");
  const organicPosts = posts.filter((post) => !post.sponsored);
  const feedAlreadyHasAd = posts.some((post) => Boolean(post.sponsored));
  const feedAdSessionKey = JSON.stringify([viewerId, feedMode, selectedTopicId, organicPosts[0]?.id ?? null]);
  const feedProductAdSessionId = useMemo(
    () => {
      const scopeHash = [...feedAdSessionKey].reduce((hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0, 0).toString(36);
      return `${createFeedProductAdSessionId()}_${scopeHash}`;
    },
    [feedAdSessionKey],
  );
  const feedProductDecision = useQuery({
    queryKey: ["ads", "feed-product-slot", viewerId, feedMode, selectedTopicId, feedProductAdSessionId],
    queryFn: () => productAdsService.decideFeedProductAd(organicPosts[7]!.id, organicPosts.slice(7, 9).map((post) => post.id), feedProductAdSessionId),
    enabled: shouldDecideFeedProductAd(feedMode, Boolean(viewerId), feedAlreadyHasAd, organicPosts.length),
    staleTime: Infinity,
    retry: false,
  });
  const decidedFeedProductAd = feedMode === "for-you" && usableFeedProductAd(feedProductDecision.data?.ad, feedProductDecision.data?.receivedAt ?? 0)
    ? feedProductDecision.data.ad
    : null;
  const feedProductSponsored = decidedFeedProductAd ? productAdSponsoredPlacement(decidedFeedProductAd) : null;
  const rows = useMemo(
    () => insertFeedProductAd(modules.rows, decidedFeedProductAd, feedProductSponsored),
    [modules.rows, decidedFeedProductAd, feedProductSponsored],
  );
  const viewabilityPairs = useFeedViewabilityTracking("feed", rows);
  const selectTopic = (topicId: string | null) => {
    setFeedMode("for-you");
    setSelectedTopicId(topicId);
  };

  return (
    <View style={styles.root}>
      <GuestFeedBanner />
      {viewerId ? (
        <View style={styles.storyTray}>
          <StoryTray
            items={storyTray.data ?? []}
            liveItems={suggestedLives.data ?? []}
            myAvatarUrl={myAvatarUrl}
            onPressAddStory={() => navigation.navigate("CreatePost", { mode: "story" })}
            onPressStory={(userId) => navigation.navigate("Story", { userId })}
            onPressLive={(liveId) => navigation.navigate("Live", { liveId })}
          />
        </View>
      ) : null}
      <FlatList
        data={rows}
        keyExtractor={(row) => row.type === "product-ad" ? row.key : row.type === "post" ? row.post.id : feedModuleRowKey(row.slot)}
        ListHeaderComponent={
          <TopicFilterRow
            topics={topics.data ?? []}
            selectedTopicId={selectedTopicId}
            feedMode={feedMode}
            onSelectTopic={selectTopic}
            onSelectMode={(mode) => {
              if (mode === "for-you") {
                setFeedMode(mode);
                setSelectedTopicId(null);
                return;
              }
              requireAuthThen(() => setFeedMode(mode), undefined, "see posts from people you follow");
            }}
          />
        }
        stickyHeaderIndices={[0]}
        showsVerticalScrollIndicator={false}
        viewabilityConfigCallbackPairs={viewabilityPairs}
        renderItem={({ item }) =>
          item.type === "product-ad" ? (
            <FeedProductAdCard ad={item.ad} />
          ) : item.type === "module" ? (
            <FeedModuleRow slot={item.slot} modules={modules} onPressRailMore={setRailOptionsClipIds} />
          ) : (
            <PostCard
              post={item.post}
              surface="feed"
              position={item.postIndex}
              onPressAuthor={() => navigation.navigate("UserProfile", { userId: item.post.author.id })}
              onToggleFollow={() => followPostAuthor(item.post)}
              onToggleLike={() => togglePostLike(item.post)}
              onPressComments={() => navigation.navigate("PostDetail", { postId: item.post.id })}
              onRepost={() => setReshareTarget(item.post)}
              onShare={() => offerSendInChat({ kind: "post", id: item.post.id }, () => sharePost(item.post))}
              onPress={() => navigation.navigate("PostDetail", { postId: item.post.id })}
              onPressOriginalPost={
                item.post.resharedFrom ? () => navigation.navigate("PostDetail", { postId: item.post.resharedFrom!.id }) : undefined
              }
              onPressViewProducts={() => setOpenPostProducts({ products: item.post.products, attribution: { source: attributionSourceForPostKind(item.post.kind), id: item.post.id } })}
              onPressAnalytics={() => navigation.navigate("PostAnalytics", { postId: item.post.id })}
            />
          )
        }
        onEndReachedThreshold={0.5}
        onEndReached={() => feed.hasNextPage && !feed.isFetchingNextPage && feed.fetchNextPage()}
        refreshControl={refreshControl}
        ListEmptyComponent={
          <>
            {feed.isLoading ? (
              <ListSkeleton />
            ) : feed.isError ? (
              <ErrorState error={feed.error} compact message="Couldn't load your feed." onRetry={() => feed.refetch()} retrying={feed.isRefetching} />
            ) : (
              <EmptyState compact title="No posts yet" body="Follow people and stores to fill your feed." actionLabel="Find people" onAction={() => navigation.navigate("Search", { scope: "global" })} />
            )}
          </>
        }
        ListFooterComponent={feed.isFetchingNextPage ? <BrandLoader size="sm" style={styles.footer} /> : undefined}
      />
      <PostProductsFlow products={openPostProducts?.products ?? null} attribution={openPostProducts?.attribution ?? null} onClose={() => setOpenPostProducts(null)} />
      <ReshareSheet post={reshareTarget} onClose={() => setReshareTarget(null)} />
      <SuggestedClipsOptionsSheet visible={railOptionsClipIds !== null} railClipIds={railOptionsClipIds ?? []} onClose={() => setRailOptionsClipIds(null)} />
      {sendInChatElement}
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  storyTray: { minHeight: 81, justifyContent: "center", paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  footer: { paddingVertical: spacing[4] },
}));
