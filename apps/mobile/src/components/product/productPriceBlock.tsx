import { Pressable, StyleSheet, View } from "react-native";

import { BookmarkFill24Icon, BookmarkSimple24Icon, Share24Icon, Star16Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import type { Product } from "@/types";
import { formatCountWithThousandsSuffix } from "@/utils/formatDate.util";
import { starsLabel } from "@/utils/productReviews.util";

import { MoneyAmount } from "./moneyAmount";
import { SponsoredLabel } from "./productCard";

export interface ProductPriceBlockProps {
  readonly product: Product;
  readonly bookmarked: boolean;
  readonly saveCount: number;
  readonly onShare: () => void;
  readonly onToggleBookmark: () => void;
  readonly onPressRating: () => void;
}

export function ProductPriceBlock({ product, bookmarked, saveCount, onShare, onToggleBookmark, onPressRating }: ProductPriceBlockProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.block}>
      <View style={styles.top}>
        {product.sponsored ? <SponsoredLabel /> : null}
        <View style={styles.priceRow}>
          <MoneyAmount money={product.price} symbolSize={14} symbolWeight={700} amountSize={21} amountWeight={600} />
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" accessibilityLabel="Share product" hitSlop={8} onPress={onShare}>
              <Share24Icon />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={bookmarked ? "Remove product from saved" : "Save product"}
              accessibilityState={{ selected: bookmarked }}
              hitSlop={8}
              style={styles.save}
              onPress={onToggleBookmark}
            >
              {bookmarked ? <BookmarkFill24Icon size={24} color={colors.primary} /> : <BookmarkSimple24Icon />}
              <Text size={12} lineHeight={14.4} color={colors.textMuted} align="center">
                {formatCountWithThousandsSuffix(Math.max(saveCount, 0))}
              </Text>
            </Pressable>
          </View>
        </View>
        <Text size={13} lineHeight={16.9} color={colors.textMuted}>
          {product.title}
        </Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={product.rating > 0 ? `Rated ${starsLabel(product.rating)}, see reviews` : "No ratings yet, see reviews"} onPress={onPressRating} style={styles.rating}>
        <Text size={12} weight={500} lineHeight={14.4}>
          {product.rating > 0 ? product.rating.toFixed(1) : "New"}
        </Text>
        <Star16Icon />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { paddingHorizontal: 12, marginTop: 24, gap: 11 },
  top: { gap: 12 },
  priceRow: { height: 25, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  save: { alignItems: "center", gap: 2 },
  actions: { flexDirection: "row", alignItems: "center", gap: 12 },
  rating: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" },
});
