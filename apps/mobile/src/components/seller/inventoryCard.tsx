import { Image } from "expo-image";
import { Pressable, StyleSheet, View } from "react-native";

import { BoxArrowDown24Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { ProductSummary } from "@/types";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";
import { spacing } from "@/constants/spacing.constant";
import { typeScale } from "@/constants/typography.constant";

const LOW_STOCK_THRESHOLD = 5;

export function InventoryCard({ product, onPress }: { product: Pick<ProductSummary, "name" | "imageUrl" | "price" | "stock">; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const stock = product.stock ?? 0;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${product.name}, ${stock} in stock`} onPress={onPress} style={styles.card}>
      <View style={styles.image}>
        {product.imageUrl ? <Image source={{ uri: product.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
      </View>
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text size={typeScale.md} lineHeight={16.8} numberOfLines={1} style={styles.name}>
            {product.name}
          </Text>
          <Text size={typeScale.md} weight={500} lineHeight={16.8}>
            {formatMoneyForDisplay(product.price)}
          </Text>
        </View>
        <View style={styles.stock}>
          <BoxArrowDown24Icon />
          <Text size={typeScale.md} weight={500} lineHeight={16.8} color={stock <= LOW_STOCK_THRESHOLD ? colors.error : colors.success}>
            {stock} in stock
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  card: { width: 175, gap: spacing[2] },
  image: { height: 170, backgroundColor: colors.placeholder, overflow: "hidden" },
  info: { gap: spacing[2] },
  nameRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 2 },
  name: { flexShrink: 1 },
  stock: { flexDirection: "row", alignItems: "center", gap: spacing[2] },
}));
