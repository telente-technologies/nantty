import { MentionText } from "@/components/mentions/mentionText";
import { useQuery } from "@tanstack/react-query";
import { FlatList, StyleSheet, View } from "react-native";

import { Star16Icon } from "@/components/icons";
import { EmptyState } from "@/components/ui/emptyState";
import { ErrorState } from "@/components/ui/errorState";
import { usePullToRefresh } from "@/components/ui/pullToRefresh.hook";
import { Avatar } from "@/components/ui/avatar";
import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { reviewsService } from "@/services/reviews.service";
import { formatTimeSincePosted } from "@/utils/formatDate.util";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { spacing } from "@/constants/spacing.constant";
import { typeScale } from "@/constants/typography.constant";

function StarRow({ rating }: { rating: number }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.stars} accessibilityLabel={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star16Icon key={i} size={12} color={i < rating ? colors.star : colors.placeholder} />
      ))}
    </View>
  );
}

export function ProductReviewsScreen({ route }: MainScreenProps<"ProductReviews">) {
  const { colors } = useTheme();
  const styles = useStyles();
  const reviews = useQuery({
    queryKey: ["products", "reviews", route.params.productId],
    queryFn: () => reviewsService.fetchProductReviews(route.params.productId),
  });
  const refreshControl = usePullToRefresh(reviews.refetch);
  return (
    <Screen>
      <Header title="Reviews" />
      {reviews.isLoading ? <ListSkeleton avatarSize={32} /> : null}
      {reviews.isError && !reviews.data ? <ErrorState message="Couldn't load reviews." onRetry={() => reviews.refetch()} retrying={reviews.isRefetching} /> : null}
      {reviews.data ? (
        <FlatList
          data={reviews.data.reviews}
          refreshControl={refreshControl}
          ListEmptyComponent={<EmptyState compact icon={<Star16Icon size={24} color={colors.textMuted} />} title="No reviews yet" body="Buyers can review this product after delivery." />}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.summary}>
              <Text size={typeScale.xxl} weight={600} lineHeight={38}>{reviews.data.average.toFixed(1)}</Text>
              <StarRow rating={Math.round(reviews.data.average)} />
              <Text size={typeScale.sm} lineHeight={16.9} color={colors.textSubtle}>{reviews.data.count} reviews</Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => (
            <View style={styles.review}>
              <View style={styles.author}>
                <Avatar uri={item.author.avatarUrl} size={32} />
                <View style={styles.authorText}>
                  <Text size={typeScale.md} weight={500} lineHeight={16.8}>{item.author.name}</Text>
                  <StarRow rating={item.rating} />
                </View>
                <Text size={typeScale.xs} lineHeight={16.8} color={colors.textSubtle}>{formatTimeSincePosted(item.createdAt)}</Text>
              </View>
              <MentionText text={item.text} size={13} lineHeight={16.9} color={colors.textMuted} />
            </View>
          )}
        />
      ) : null}
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  list: { paddingHorizontal: spacing[4], paddingBottom: spacing[6] },
  summary: { alignItems: "center", paddingVertical: spacing[5], gap: 6 },
  stars: { flexDirection: "row", gap: 2 },
  separator: { height: 1, backgroundColor: colors.divider },
  review: { paddingVertical: spacing[4], gap: spacing[2] },
  author: { flexDirection: "row", alignItems: "center", gap: spacing[2] },
  authorText: { flex: 1, gap: 2 },
}));
