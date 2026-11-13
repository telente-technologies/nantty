import { Image } from "expo-image";
import { useEffect } from "react";
import { Pressable, StyleSheet, View, type DimensionValue } from "react-native";

import { Like16Icon, Plus16Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { adEventsService } from "@/services/ads/adEvents.service";
import type { AdPlacement, ProductSummary } from "@/types";
import { formatProductPriceForDisplay } from "@/utils/formatMoney.util";
import { VerificationBadge } from "@/components/profile/verificationBadge";

export interface ProductCardProps {
  readonly product: ProductSummary;
  readonly variant?: "mart" | "grid";
  readonly imageHeight?: number;
  readonly width?: DimensionValue;
  readonly onPress?: () => void;
  readonly onAddToCart?: () => void;
  readonly onToggleLike?: () => void;
  readonly adPlacement?: AdPlacement;
}

export function ProductCard({ product, variant = "grid", imageHeight, width = 175, onPress, onAddToCart, onToggleLike, adPlacement = "mart" }: ProductCardProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const isMart = variant === "mart";
  const sponsored = product.sponsored;
  useEffect(() => {
    if (sponsored) adEventsService.recordSponsoredImpressionOncePerSession(sponsored, adPlacement, product.id);
  }, [sponsored, adPlacement, product.id]);
  const openProduct = () => {
    if (sponsored) adEventsService.recordSponsoredClick(sponsored, adPlacement, product.id);
    onPress?.();
  };
  const height = imageHeight ?? (isMart ? 227 : 170);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={sponsored ? `Ad, ${product.name}` : product.name} onPress={openProduct} style={[styles.card, { width }]}>
      <View style={[styles.image, { height, borderRadius: isMart ? 4 : 0 }]}>
        {product.imageUrl ? <Image source={{ uri: product.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
        {sponsored ? <AdPill /> : null}
      </View>
      {isMart ? (
        <View style={styles.martInfo}>
          <Text size={12} lineHeight={16.8} numberOfLines={1}>
            {product.name}
          </Text>
          {product.storeName ? (
            <View style={styles.storeIdentity}>
              <Text size={11} lineHeight={14} numberOfLines={1} color={colors.textMuted}>{product.storeName}</Text>
              {product.storeVerified ? <VerificationBadge checkmarkColor="gold" size={14} /> : null}
            </View>
          ) : null}
          <View style={styles.priceRow}>
            <Text size={14} weight={500} lineHeight={16.8}>
              {formatProductPriceForDisplay(product)}
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel={`Add ${product.name} to cart`} hitSlop={12} onPress={onAddToCart}>
              <Plus16Icon />
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.gridInfo}>
          <View style={styles.gridText}>
              <Text size={13} lineHeight={16.9} numberOfLines={1}>
              {product.name}
            </Text>
            <Text size={13} weight={500} lineHeight={16.9}>
              {formatProductPriceForDisplay(product)}
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

export function AdPill() {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.adPill} accessible accessibilityLabel="Advertisement">
      <Text size={11} weight={500} lineHeight={13.2} letterSpacing={0} color={colors.textMuted}>
        Ad
      </Text>
    </View>
  );
}

export function SponsoredLabel() {
  const { colors } = useTheme();
  return (
    <Text size={12} weight={400} lineHeight={14.4} color={colors.textSubtle} accessibilityLabel="Sponsored">
      Sponsored
    </Text>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  card: { gap: 8 },
  image: { width: "100%", backgroundColor: colors.placeholder, overflow: "hidden" },
  martInfo: { paddingHorizontal: 8, gap: 4 },
  storeIdentity: { flexDirection: "row", alignItems: "center", gap: 3 },
  priceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  gridInfo: { flexDirection: "row", justifyContent: "space-between", gap: 19 },
  gridText: { flex: 1, gap: 2 },
  adPill: { position: "absolute", top: 8, left: 8, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99, backgroundColor: colors.skeleton },
}));
