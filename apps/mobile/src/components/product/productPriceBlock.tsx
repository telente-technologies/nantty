import { Pressable, StyleSheet, View } from "react-native";

import { BookmarkSimple24Icon, Share24Icon, Star16Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { Product } from "@/types";

import { MoneyAmount } from "./moneyAmount";

export interface ProductPriceBlockProps {
  readonly product: Product;
  readonly bookmarked: boolean;
  readonly onShare: () => void;
  readonly onToggleBookmark: () => void;
  readonly onPressRating: () => void;
}

export function ProductPriceBlock({ product, bookmarked, onShare, onToggleBookmark, onPressRating }: ProductPriceBlockProps) {
  return (
    <View style={styles.block}>
      <View style={styles.top}>
        <View style={styles.priceRow}>
          <MoneyAmount money={product.price} symbolSize={14} symbolWeight={700} amountSize={21} amountWeight={600} />
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" accessibilityLabel="Share product" hitSlop={8} onPress={onShare}>
              <Share24Icon />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={bookmarked ? "Remove bookmark" : "Bookmark product"}
              accessibilityState={{ selected: bookmarked }}
              hitSlop={8}
              onPress={onToggleBookmark}
            >
              <BookmarkSimple24Icon color={bookmarked ? colors.primary : undefined} />
            </Pressable>
          </View>
        </View>
        <Text size={13} lineHeight={16.9} color={colors.textMuted}>
          {product.title}
        </Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Rated ${product.rating}, see reviews`} onPress={onPressRating} style={styles.rating}>
        <Text size={12} weight={500} lineHeight={14.4}>
          {product.rating.toFixed(1)}
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
  actions: { flexDirection: "row", alignItems: "center", gap: 12 },
  rating: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" },
});
