import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from "react-native";

import { GuestFeedBanner } from "@/components/auth/guestFeedBanner";
import { useShareToChat } from "@/components/chatSafety/shareToChat.hook";
import { SwipeablePostCard } from "@/components/feed/swipeablePostCard";
import { ReshareSheet } from "@/components/feed/reshareSheet";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { useCartActions } from "@/hooks/useCart.hook";
import { feedQueryKeyPrefix, usePostInteractions } from "@/hooks/usePostInteractions.hook";
import { feedsService } from "@/services/feeds.service";
import type { Post, ProductSummary } from "@/types";
import { requireAuthAfterClosingModal, requireAuthThen } from "@/utils/requireAuth.util";

import { PostProductsSheet } from "./postProductsSheet";
import { SuggestedClipsRow } from "./suggestedClipsRow";
import { TopicFilterRow } from "./topicFilterRow";
import { ListSkeleton } from "@/components/ui/listSkeleton";

type FeedRow = { type: "post"; post: Post } | { type: "suggestedClips" };
type FeedMode = "for-you" | "following";

const SUGGESTED_CLIPS_POSITION = 2;

export function FeedTab() {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation();
  const [feedMode, setFeedMode] = useState<FeedMode>("for-you");
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [productsInOpenPost, setProductsInOpenPost] = useState<readonly ProductSummary[] | null>(null);
  const [reshareTarget, setReshareTarget] = useState<Post | null>(null);
  const [isSwipingPost, setIsSwipingPost] = useState(false);
  const { togglePostLike, followPostAuthor, sharePost } = usePostInteractions();
  const { addProductToCart } = useCartActions();
  const { offerSendInChat, sendInChatElement } = useShareToChat();

  const topics = useQuery({ queryKey: ["topics", "mine"], queryFn: feedsService.fetchMyFollowedTopics });
  const suggestedClips = useQuery({ queryKey: ["feed-suggested-clips"], queryFn: feedsService.fetchSuggestedClips });
  const feed = useInfiniteQuery({
    queryKey: [...feedQueryKeyPrefix, feedMode, selectedTopicId],
    queryFn: ({ pageParam }) =>
      feedMode === "following"
        ? feedsService.fetchFollowingFeedPage(pageParam)
        : feedsService.fetchForYouFeedPage(selectedTopicId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  const rows = useMemo<FeedRow[]>(() => {
    const seenPostIds = new Set<string>();
    const posts: FeedRow[] = [];
    for (const page of feed.data?.pages ?? []) {
      for (const post of page.data) {
        if (seenPostIds.has(post.id)) continue;
        seenPostIds.add(post.id);
        posts.push({ type: "post", post });
      }
    }
    if (posts.length > SUGGESTED_CLIPS_POSITION && (suggestedClips.data?.length ?? 0) > 0) {
      posts.splice(SUGGESTED_CLIPS_POSITION, 0, { type: "suggestedClips" });
    }
    return posts;
  }, [feed.data, suggestedClips.data]);

  const selectTopic = (topicId: string | null) => {
    setFeedMode("for-you");
    setSelectedTopicId(topicId);
  };

  const addEveryPostProductToCart = (products: readonly ProductSummary[]) =>
    requireAuthAfterClosingModal(
      () => setProductsInOpenPost(null),
      async () => {
        for (const product of products) await addProductToCart.mutateAsync({ productId: product.id, quantity: 1 });
        setProductsInOpenPost(null);
        navigation.navigate("Cart");
      },
      "add to cart",
    );

  return (
    <View style={styles.root}>
      <GuestFeedBanner />
      <FlatList
        data={rows}
        keyExtractor={(row) => (row.type === "post" ? row.post.id : "suggested-clips")}
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
        scrollEnabled={!isSwipingPost}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) =>
          item.type === "suggestedClips" ? (
            <SuggestedClipsRow clips={suggestedClips.data ?? []} onPressClip={(clipId) => navigation.navigate("Tabs", { screen: "Clips", params: { startId: clipId } })} />
          ) : (
            <SwipeablePostCard
              post={item.post}
              onOpenComments={() => navigation.navigate("PostDetail", { postId: item.post.id })}
              onSwipeActiveChange={setIsSwipingPost}
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
              onPressViewProducts={() => setProductsInOpenPost(item.post.products)}
              onPressAnalytics={() => navigation.navigate("PostAnalytics", { postId: item.post.id })}
            />
          )
        }
        onEndReachedThreshold={0.5}
        onEndReached={() => feed.hasNextPage && !feed.isFetchingNextPage && feed.fetchNextPage()}
        refreshControl={<RefreshControl refreshing={feed.isRefetching} onRefresh={() => feed.refetch()} tintColor={colors.primary} />}
        ListEmptyComponent={
          feed.isLoading ? (
            <ListSkeleton />
          ) : (
            <Text style={styles.state} align="center" color={colors.textSubtle}>
              {feed.isError ? "Couldn't load your feed. Pull to try again." : "No posts yet. Follow people to fill your feed."}
            </Text>
          )
        }
        ListFooterComponent={feed.isFetchingNextPage ? <ActivityIndicator style={styles.footer} color={colors.primary} /> : null}
      />
      <PostProductsSheet
        products={productsInOpenPost}
        onClose={() => setProductsInOpenPost(null)}
        onPressProduct={(productId) => {
          setProductsInOpenPost(null);
          navigation.navigate("ProductDetail", { productId });
        }}
        onAddAllToCart={addEveryPostProductToCart}
        adding={addProductToCart.isPending}
      />
      <ReshareSheet post={reshareTarget} onClose={() => setReshareTarget(null)} />
      {sendInChatElement}
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  state: { marginTop: 48, paddingHorizontal: 32 },
  footer: { paddingVertical: 16 },
}));
