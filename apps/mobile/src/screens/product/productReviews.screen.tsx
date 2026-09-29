import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";

import { Star16Icon } from "@/components/icons";
import { Avatar } from "@/components/ui/avatar";
import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { reviewsService } from "@/services/reviews.service";
import { formatTimeSincePosted } from "@/utils/formatDate.util";

function StarRow({ rating }: { rating: number }) {
  return (
    <View style={styles.stars} accessibilityLabel={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star16Icon key={i} size={12} color={i < rating ? colors.star : colors.placeholder} />
      ))}
    </View>
  );
}

export function ProductReviewsScreen({ route }: MainScreenProps<"ProductReviews">) {
  const reviews = useQuery({
    queryKey: ["products", "reviews", route.params.productId],
    queryFn: () => reviewsService.fetchProductReviews(route.params.productId),
  });
  return (
    <Screen>
      <Header title="Reviews" />
      {reviews.isLoading ? <ActivityIndicator style={styles.state} color={colors.primary} /> : null}
      {reviews.data ? (
        <FlatList
          data={reviews.data.reviews}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.summary}>
              <Text size={32} weight={600} lineHeight={38}>{reviews.data.average.toFixed(1)}</Text>
              <StarRow rating={Math.round(reviews.data.average)} />
              <Text size={13} lineHeight={16.9} color={colors.textSubtle}>{reviews.data.count} reviews</Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => (
            <View style={styles.review}>
              <View style={styles.author}>
                <Avatar uri={item.author.avatarUrl} size={32} />
                <View style={styles.authorText}>
                  <Text size={14} weight={500} lineHeight={16.8}>{item.author.name}</Text>
                  <StarRow rating={item.rating} />
                </View>
                <Text size={12} lineHeight={16.8} color={colors.textSubtle}>{formatTimeSincePosted(item.createdAt)}</Text>
              </View>
              <Text size={13} lineHeight={16.9} color={colors.textMuted}>{item.text}</Text>
            </View>
          )}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  state: { marginTop: 64 },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  summary: { alignItems: "center", paddingVertical: 20, gap: 6 },
  stars: { flexDirection: "row", gap: 2 },
  separator: { height: 1, backgroundColor: colors.divider },
  review: { paddingVertical: 16, gap: 8 },
  author: { flexDirection: "row", alignItems: "center", gap: 9 },
  authorText: { flex: 1, gap: 2 },
});
