import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from "react-native";

import { PostCard } from "@/components/feed/post-card";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import { useCartActions } from "@/hooks/useCart.hook";
import { feedQueryKeyPrefix, usePostInteractions } from "@/hooks/usePostInteractions.hook";
import { feedsService } from "@/services/feeds.service";
import type { Post, ProductSummary } from "@/types";

import { PostProductsSheet } from "./postProductsSheet";
import { SuggestedClipsRow } from "./suggestedClipsRow";
import { TopicFilterRow } from "./topicFilterRow";

type FeedRow = { type: "post"; post: Post } | { type: "suggestedClips" };

const SUGGESTED_CLIPS_POSITION = 2;

export function FeedTab() {
  const navigation = useNavigation();
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [productsInOpenPost, setProductsInOpenPost] = useState<readonly ProductSummary[] | null>(null);
  const { togglePostLike, followPostAuthor, repostPost, sharePost } = usePostInteractions();
  const { addProductToCart } = useCartActions();

  const topics = useQuery({ queryKey: ["topics", "mine"], queryFn: feedsService.fetchMyFollowedTopics });
  const suggestedClips = useQuery({ queryKey: ["feed-suggested-clips"], queryFn: feedsService.fetchSuggestedClips });
  const feed = useInfiniteQuery({
    queryKey: [...feedQueryKeyPrefix, "for-you", selectedTopicId],
    queryFn: ({ pageParam }) => feedsService.fetchForYouFeedPage(selectedTopicId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  const rows = useMemo<FeedRow[]>(() => {
    const posts: FeedRow[] = (feed.data?.pages ?? []).flatMap((page) => page.data.map((post) => ({ type: "post" as const, post })));
    if (posts.length > SUGGESTED_CLIPS_POSITION && (suggestedClips.data?.length ?? 0) > 0) {
      posts.splice(SUGGESTED_CLIPS_POSITION, 0, { type: "suggestedClips" });
    }
    return posts;
  }, [feed.data, suggestedClips.data]);

  const addEveryPostProductToCart = async (products: readonly ProductSummary[]) => {
    for (const product of products) await addProductToCart.mutateAsync({ productId: product.id, quantity: 1 });
    setProductsInOpenPost(null);
    navigation.navigate("Cart");
  };

  return (
    <View style={styles.root}>
      <FlatList
        data={rows}
        keyExtractor={(row) => (row.type === "post" ? row.post.id : "suggested-clips")}
        ListHeaderComponent={
          <TopicFilterRow topics={topics.data ?? []} selectedTopicId={selectedTopicId} onSelectTopic={setSelectedTopicId} />
        }
        stickyHeaderIndices={[0]}
        renderItem={({ item }) =>
          item.type === "suggestedClips" ? (
            <SuggestedClipsRow clips={suggestedClips.data ?? []} onPressClip={(clipId) => navigation.navigate("Tabs", { screen: "Clips", params: { startId: clipId } })} />
          ) : (
            <PostCard
              post={item.post}
              onPressAuthor={() => navigation.navigate("UserProfile", { userId: item.post.author.id })}
              onToggleFollow={() => followPostAuthor(item.post)}
              onToggleLike={() => togglePostLike(item.post)}
              onPressComments={() => navigation.navigate("PostDetail", { postId: item.post.id })}
              onRepost={() => repostPost(item.post)}
              onShare={() => sharePost(item.post)}
              onPress={() => navigation.navigate("PostDetail", { postId: item.post.id })}
              onPressViewProducts={() => setProductsInOpenPost(item.post.products)}
            />
          )
        }
        onEndReachedThreshold={0.5}
        onEndReached={() => feed.hasNextPage && !feed.isFetchingNextPage && feed.fetchNextPage()}
        refreshControl={<RefreshControl refreshing={feed.isRefetching} onRefresh={() => feed.refetch()} tintColor={colors.primary} />}
        ListEmptyComponent={
          feed.isLoading ? (
            <ActivityIndicator style={styles.state} color={colors.primary} />
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  state: { marginTop: 48, paddingHorizontal: 32 },
  footer: { paddingVertical: 16 },
});
