import { StyleSheet, View } from "react-native";

import { StarOutline16Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/emptyState";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";

import { RatingSummary } from "./ratingSummary";
import { useRatingSummaryQuery, useReviewPreviewQuery, useViewerAccountId } from "./reviewQueries.hook";
import { ReviewRow } from "./reviewRow";

export function ProductReviewsSection({ productId, onSeeAll }: { productId: string; onSeeAll: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const summary = useRatingSummaryQuery(productId);
  const preview = useReviewPreviewQuery(productId);
  const viewerId = useViewerAccountId();
  const count = summary.data?.count ?? preview.data?.count ?? 0;

  return (
    <View style={styles.section}>
      <Text size={16} weight={600} lineHeight={19.2} accessibilityRole="header">Ratings & reviews</Text>
      {summary.isError && preview.isError ? (
        <Text size={13} lineHeight={16.9} color={colors.textMuted} accessibilityRole="button" onPress={() => { void summary.refetch(); void preview.refetch(); }}>
          Couldn't load reviews. Tap to try again.
        </Text>
      ) : null}
      {summary.data && count > 0 ? <RatingSummary summary={summary.data} /> : null}
      {summary.data && count === 0 ? (
        <EmptyState compact icon={<StarOutline16Icon size={24} color={colors.textMuted} />} title="No reviews yet" body="Buyers can rate this product after it's delivered." />
      ) : null}
      {(preview.data?.reviews ?? []).map((review, index) => (
        <View key={review.id} style={index > 0 ? styles.separated : undefined}>
          <ReviewRow review={review} isOwn={!!viewerId && review.author.id === viewerId} />
        </View>
      ))}
      {count > 0 ? <Button variant="subtle" title={`See all ${count} ${count === 1 ? "review" : "reviews"}`} onPress={onSeeAll} /> : null}
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  section: { paddingHorizontal: 12, gap: 12 },
  separated: { borderTopWidth: 1, borderTopColor: colors.divider },
}));
