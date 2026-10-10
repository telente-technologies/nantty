import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from "react-native";

import { PostCard } from "@/components/feed/postCard";
import { ErrorState } from "@/components/ui/errorState";
import { Header } from "@/components/ui/header";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { usePostInteractions } from "@/hooks/usePostInteractions.hook";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { postsService } from "@/services/content/posts.service";
import { useTheme } from "@/theme";

export const postQuotesQueryKey = (postId: string) => ["feed", "quotes", postId] as const;

export function PostQuotesScreen({ navigation, route }: MainScreenProps<"PostQuotes">) {
  const { colors } = useTheme();
  const { postId } = route.params;
  const interactions = usePostInteractions();
  const quotes = useInfiniteQuery({
    queryKey: postQuotesQueryKey(postId),
    queryFn: ({ pageParam }) => postsService.fetchPostQuotes(postId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const posts = useMemo(() => quotes.data?.pages.flatMap((page) => page.data) ?? [], [quotes.data]);
  const loadMore = () => {
    if (quotes.hasNextPage && !quotes.isFetchingNextPage) quotes.fetchNextPage().catch(() => undefined);
  };

  return (
    <Screen>
      <Header title="Quotes" />
      {quotes.isPending ? (
        <ListSkeleton />
      ) : quotes.isError ? (
        <ErrorState message={quotes.error.message} onRetry={() => quotes.refetch()} />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(post) => post.id}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              onPress={() => navigation.push("PostDetail", { postId: item.id })}
              onPressOriginalPost={() => navigation.push("PostDetail", { postId })}
              onToggleLike={() => interactions.togglePostLike(item)}
              onShare={() => interactions.sharePost(item)}
              onPressComments={() => navigation.push("PostDetail", { postId: item.id })}
            />
          )}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          refreshControl={<RefreshControl refreshing={quotes.isRefetching && !quotes.isFetchingNextPage} onRefresh={() => quotes.refetch()} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text size={16} weight={600} lineHeight={20} align="center">No quotes to show</Text>
              <Text size={14} lineHeight={20} align="center" color={colors.textMuted}>Quotes from private accounts or ones you can't see stay hidden.</Text>
            </View>
          }
          ListFooterComponent={quotes.isFetchingNextPage ? <ActivityIndicator style={styles.footer} color={colors.primary} /> : null}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { paddingHorizontal: 32, paddingVertical: 48, gap: 8 },
  footer: { paddingVertical: 24 },
});
