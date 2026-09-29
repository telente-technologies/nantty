import { Image } from "expo-image";
import { Pressable, StyleSheet, View, type DimensionValue } from "react-native";

import { Like16Icon, Plus16Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { ProductSummary } from "@/types";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

export interface ProductCardProps {
  readonly product: ProductSummary;
  readonly variant?: "mart" | "grid";
  readonly imageHeight?: number;
  readonly width?: DimensionValue;
  readonly onPress?: () => void;
  readonly onAddToCart?: () => void;
  readonly onToggleLike?: () => void;
}

export function ProductCard({ product, variant = "grid", imageHeight, width = 175, onPress, onAddToCart, onToggleLike }: ProductCardProps) {
  const isMart = variant === "mart";
  const height = imageHeight ?? (isMart ? 227 : 170);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={product.sponsored ? `Sponsored, ${product.name}` : product.name} onPress={onPress} style={[styles.card, { width }]}>
      <View style={[styles.image, { height, borderRadius: isMart ? 4 : 0 }]}>
        {product.imageUrl ? <Image source={{ uri: product.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
      </View>
      {isMart ? (
        <View style={styles.martInfo}>
          {product.sponsored ? <SponsoredLabel /> : null}
          <Text size={12} lineHeight={16.8} numberOfLines={1}>
            {product.name}
          </Text>
          <View style={styles.priceRow}>
            <Text size={14} weight={500} lineHeight={16.8}>
              {formatMoneyForDisplay(product.price)}
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel={`Add ${product.name} to cart`} hitSlop={12} onPress={onAddToCart}>
              <Plus16Icon />
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.gridInfo}>
          <View style={styles.gridText}>
            {product.sponsored ? <SponsoredLabel /> : null}
            <Text size={13} lineHeight={16.9} numberOfLines={1}>
              {product.name}
            </Text>
            <Text size={13} weight={500} lineHeight={16.9}>
              {formatMoneyForDisplay(product.price)}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={product.liked ? `Unlike ${product.name}` : `Like ${product.name}`}
            hitSlop={12}
            onPress={onToggleLike}
          >
            <Like16Icon color={product.liked ? colors.error : undefined} />
          </Pressable>
        </View>
      )}
    </Pressable>
  );
}

export function SponsoredLabel() {
  return (
    <Text size={12} weight={400} lineHeight={14.4} color={colors.textSubtle} accessibilityLabel="Sponsored">
      Sponsored
    </Text>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8 },
  image: { width: "100%", backgroundColor: colors.placeholder, overflow: "hidden" },
  martInfo: { paddingHorizontal: 8, gap: 4 },
  priceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  gridInfo: { flexDirection: "row", justifyContent: "space-between", gap: 19 },
  gridText: { flex: 1, gap: 2 },
});
