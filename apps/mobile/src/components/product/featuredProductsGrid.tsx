import { StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";

import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import { useProductLikeToggle } from "@/hooks/useProductLike.hook";
import type { ProductSummary } from "@/types";

import { ProductCard } from "./productCard";

export interface FeaturedProductsGridProps {
  readonly products: readonly ProductSummary[];
  readonly title?: string;
}

export function FeaturedProductsGrid({ products, title = "Featured with" }: FeaturedProductsGridProps) {
  const navigation = useNavigation();
  const toggleProductLike = useProductLikeToggle();
  const rows: ProductSummary[][] = [];
  for (let i = 0; i < products.length; i += 2) rows.push(products.slice(i, i + 2));

  return (
    <View style={styles.section}>
      <Text size={16} weight={500} lineHeight={19.2} color={colors.textMuted} style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.rows}>
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.row}>
            {row.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                variant="grid"
                onPress={() => navigation.navigate("ProductDetail", { productId: product.id })}
                onToggleLike={() => toggleProductLike(product)}
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 23 },
  title: { paddingHorizontal: 16 },
  rows: { gap: 12 },
  row: { paddingHorizontal: 12, flexDirection: "row", justifyContent: "space-between" },
});
