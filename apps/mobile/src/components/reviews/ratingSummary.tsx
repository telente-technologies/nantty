import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { ProductRatingSummary } from "@/types/commerce.type";
import { ratingBreakdown, starsLabel } from "@/utils/productReviews.util";

import { StarRating } from "./starRating";

type RatingSummaryData = Pick<ProductRatingSummary, "average" | "count"> & { readonly distribution?: ProductRatingSummary["distribution"] };

export function RatingSummary({ summary }: { summary: RatingSummaryData }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const rows = summary.distribution ? ratingBreakdown({ count: summary.count, distribution: summary.distribution }) : [];
  return (
    <View style={styles.wrap}>
      <View style={styles.headline} accessible accessibilityLabel={`Rated ${starsLabel(summary.average)} from ${summary.count} ${summary.count === 1 ? "review" : "reviews"}`}>
        <Text size={32} weight={600} lineHeight={38}>{summary.average.toFixed(1)}</Text>
        <StarRating rating={summary.average} size={14} />
        <Text size={12} lineHeight={16.8} color={colors.textSubtle}>
          {summary.count} {summary.count === 1 ? "review" : "reviews"}
        </Text>
      </View>
      {rows.length ? <View style={styles.bars}>
        {rows.map((row) => (
          <View key={row.star} style={styles.barRow} accessible accessibilityLabel={`${row.star} stars: ${row.count} ${row.count === 1 ? "review" : "reviews"}`}>
            <Text size={12} lineHeight={14.4} color={colors.textMuted} style={styles.starLabel}>{row.star}</Text>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.round(row.share * 100)}%` }]} />
            </View>
            <Text size={12} lineHeight={14.4} color={colors.textSubtle} style={styles.count}>{row.count}</Text>
          </View>
        ))}
      </View> : null}
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", gap: 16 },
  headline: { alignItems: "center", gap: 4, minWidth: 88 },
  bars: { flex: 1, gap: 6 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  starLabel: { width: 10 },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.placeholder, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.star },
  count: { minWidth: 24, textAlign: "right" },
}));
