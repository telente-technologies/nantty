import { useInfiniteQuery } from "@tanstack/react-query";
import { FlatList, StyleSheet, View } from "react-native";

import { StarOutline16Icon } from "@/components/icons";
import { RatingSummary } from "@/components/reviews/ratingSummary";
import { reviewQueryKeys, useDeleteOwnReview, useRatingSummaryQuery, useViewerAccountId } from "@/components/reviews/reviewQueries.hook";
import { ReviewRow } from "@/components/reviews/reviewRow";
import { BrandLoader } from "@/components/ui/brandLoader";
import { EmptyState } from "@/components/ui/emptyState";
import { ErrorState } from "@/components/ui/errorState";
import { Header } from "@/components/ui/header";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { usePullToRefresh } from "@/components/ui/pullToRefresh.hook";
import { Screen } from "@/components/ui/screen";
import { makeThemedStyles, useTheme } from "@/theme";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { reviewsService } from "@/services/catalog/reviews.service";

export function ProductReviewsScreen({ route }: MainScreenProps<"ProductReviews">) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { productId } = route.params;
  const summary = useRatingSummaryQuery(productId);
  const viewerId = useViewerAccountId();
  const { confirmDelete } = useDeleteOwnReview(productId);
  const reviews = useInfiniteQuery({
    queryKey: reviewQueryKeys.list(productId),
    queryFn: ({ pageParam }) => reviewsService.fetchProductReviews(productId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
  const items = reviews.data?.pages.flatMap((page) => page.reviews) ?? [];
  const refreshControl = usePullToRefresh(reviews.refetch, summary.refetch);

  return (
    <Screen>
      <Header title="Reviews" />
      {reviews.isLoading ? <ListSkeleton avatarSize={32} /> : null}
      {reviews.isError && !reviews.data ? <ErrorState message="Couldn't load reviews." onRetry={() => reviews.refetch()} retrying={reviews.isRefetching} /> : null}
      {reviews.data ? (
        <FlatList
          data={items}
          refreshControl={refreshControl}
          keyExtractor={(review) => review.id}
          contentContainerStyle={styles.list}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (reviews.hasNextPage && !reviews.isFetchingNextPage) void reviews.fetchNextPage();
          }}
          ListEmptyComponent={<EmptyState compact icon={<StarOutline16Icon size={24} color={colors.textMuted} />} title="No reviews yet" body="Buyers can rate this product after it's delivered." />}
          ListHeaderComponent={summary.data && summary.data.count > 0 ? <View style={styles.summary}><RatingSummary summary={summary.data} /></View> : null}
          ListFooterComponent={reviews.isFetchingNextPage ? <BrandLoader size="sm" style={styles.footer} accessibilityLabel="Loading more reviews" /> : null}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => {
            const isOwn = !!viewerId && item.author.id === viewerId;
            return <ReviewRow review={item} isOwn={isOwn} onDelete={isOwn ? () => confirmDelete(item.id) : undefined} />;
          }}
        />
      ) : null}
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  summary: { paddingVertical: 20 },
  separator: { height: 1, backgroundColor: colors.divider },
  footer: { paddingVertical: 16 },
}));
