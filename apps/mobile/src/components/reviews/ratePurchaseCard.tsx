import { Image } from "expo-image";
import { Pressable, StyleSheet, View } from "react-native";

import { StarOutline16Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { useReviewedProductsStore } from "@/store/reviewedProducts.store";
import { makeThemedStyles, useTheme } from "@/theme";
import type { Order, ProductSummary } from "@/types";
import { reviewableProductsInOrder } from "@/utils/productReviews.util";

export function RatePurchaseCard({ order, onRate }: { order: Pick<Order, "status" | "items">; onRate: (product: ProductSummary) => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const reviewedProductIds = useReviewedProductsStore((state) => state.reviewedProductIds);
  const products = reviewableProductsInOrder(order, reviewedProductIds);
  if (products.length === 0) return null;
  return (
    <View style={styles.card}>
      <Text size={14} weight={600} lineHeight={16.8} accessibilityRole="header">Rate your purchase</Text>
      <Text size={12} lineHeight={16.8} color={colors.textMuted}>Your review helps other buyers and the seller.</Text>
      {products.map((product) => (
        <Pressable key={product.id} accessibilityRole="button" accessibilityLabel={`Write a review for ${product.name}`} onPress={() => onRate(product)} style={styles.row}>
          <View style={styles.thumb}>{product.imageUrl ? <Image source={{ uri: product.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}</View>
          <Text size={13} lineHeight={16.9} numberOfLines={1} style={styles.flex}>{product.name}</Text>
          <View style={styles.stars}>
            {Array.from({ length: 5 }, (_, index) => <StarOutline16Icon key={index} size={14} color={colors.textSubtle} />)}
          </View>
        </Pressable>
      ))}
    </View>
  );
}

export function RatePurchaseLink({ order, onRate }: { order: Pick<Order, "status" | "items">; onRate: (product: ProductSummary) => void }) {
  const { colors } = useTheme();
  const reviewedProductIds = useReviewedProductsStore((state) => state.reviewedProductIds);
  const first = reviewableProductsInOrder(order, reviewedProductIds)[0];
  if (!first) return null;
  return (
    <Text size={12} weight={500} lineHeight={16.8} color={colors.primary} accessibilityRole="button" accessibilityLabel={`Rate your purchase: ${first.name}`} onPress={() => onRate(first)} style={linkStyles.link}>
      Rate your purchase
    </Text>
  );
}

const linkStyles = StyleSheet.create({ link: { alignSelf: "flex-start", paddingBottom: 8, paddingLeft: 52 } });

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  flex: { flex: 1 },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 },
  thumb: { width: 36, height: 36, borderRadius: 6, overflow: "hidden", backgroundColor: colors.placeholder },
  stars: { flexDirection: "row", gap: 2 },
}));
