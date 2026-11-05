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

type FeedMode = "for-you" | "following";
export function FeedTab() {
  const styles = useStyles();
  const navigation = useNavigation();
  const [feedMode, setFeedMode] = useState<FeedMode>("for-you");
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [openPostProducts, setOpenPostProducts] = useState<{ readonly products: readonly ProductSummary[]; readonly attribution: SaleAttribution } | null>(null);
  const [reshareTarget, setReshareTarget] = useState<Post | null>(null);
  const { togglePostLike, followPostAuthor, sharePost } = usePostInteractions();
  const { offerSendInChat, sendInChatElement } = useShareToChat();

  const topics = useQuery({ queryKey: ["topics", "mine"], queryFn: feedsService.fetchMyFollowedTopics });
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
  const modules = useFeedModules(posts);
  const rows = modules.rows;
  const selectTopic = (topicId: string | null) => {
    setFeedMode("for-you");
    setSelectedTopicId(topicId);
  };

  return (
    <View style={styles.root}>
      <GuestFeedBanner />
      <FlatList
        data={rows}
        keyExtractor={(row) => (row.type === "post" ? row.post.id : feedModuleRowKey(row.slot))}
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
        renderItem={({ item }) =>
          item.type === "module" ? (
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
  footer: { paddingVertical: spacing[4] },
}));
