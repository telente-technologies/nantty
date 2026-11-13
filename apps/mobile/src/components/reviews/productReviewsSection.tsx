import { StyleSheet, View } from "react-native";

import { StarOutline16Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/emptyState";
import { ErrorState } from "@/components/ui/errorState";
import { Text } from "@/components/ui/text";
import { BrandLoader } from "@/components/ui/brandLoader";
import { makeThemedStyles, useTheme } from "@/theme";

import { RatingSummary } from "./ratingSummary";
import { useRatingSummaryQuery, useReviewPreviewQuery, useViewerAccountId } from "./reviewQueries.hook";
import { ReviewRow } from "./reviewRow";
import { StarRating } from "./starRating";

export function ProductReviewsSection({ productId, onSeeAll }: { productId: string; onSeeAll: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const summary = useRatingSummaryQuery(productId);
  const preview = useReviewPreviewQuery(productId);
  const viewerId = useViewerAccountId();
  const count = preview.data?.count ?? summary.data?.count ?? 0;
  const retryReviews = () => {
    void summary.refetch();
    void preview.refetch();
  };

  return (
    <View style={styles.section}>
      <Text size={16} weight={600} lineHeight={19.2} accessibilityRole="header">Ratings & reviews</Text>
      {!summary.data && !preview.data && (summary.isPending || preview.isPending) ? (
        <BrandLoader size="sm" accessibilityLabel="Loading product reviews" />
      ) : null}
      {!preview.data && preview.isError ? (
        <ErrorState error={preview.error ?? summary.error} compact message="Couldn't load reviews." onRetry={retryReviews} />
      ) : null}
      {summary.data && count > 0 ? <RatingSummary summary={summary.data} /> : null}
      {!summary.data && preview.data && count > 0 ? (
        <View style={styles.previewSummary} accessible accessibilityLabel={`Rated ${preview.data.average.toFixed(1)} from ${count} ${count === 1 ? "review" : "reviews"}`}>
          <Text size={24} weight={600} lineHeight={29}>{preview.data.average.toFixed(1)}</Text>
          <StarRating rating={preview.data.average} size={14} />
          <Text size={12} lineHeight={16.8} color={colors.textSubtle}>{count} {count === 1 ? "review" : "reviews"}</Text>
        </View>
      ) : null}
      {count === 0 && !preview.isError && (preview.isSuccess || summary.data?.count === 0) ? (
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
  previewSummary: { flexDirection: "row", alignItems: "center", gap: 8 },
}));
