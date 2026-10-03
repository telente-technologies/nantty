import { StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";

import { ProductCard } from "@/components/product/productCard";
import { useCartActions } from "@/hooks/useCart.hook";
import { trackProductInteraction } from "@/services/productInteractions.service";
import type { AdPlacement, ProductSummary } from "@/types";

const TALL_IMAGE = 227;
const SHORT_IMAGE = 183;

export function ProductMasonry({ products, adPlacement = "mart" }: { products: readonly ProductSummary[]; adPlacement?: AdPlacement }) {
  const navigation = useNavigation();
  const { addProductToCart } = useCartActions();
  const columns: [ProductSummary[], ProductSummary[]] = [[], []];
  products.forEach((product, index) => columns[index % 2]!.push(product));

  return (
    <View style={styles.grid}>
      {columns.map((column, columnIndex) => (
        <View key={columnIndex} style={styles.column}>
          {column.map((product, rowIndex) => (
            <ProductCard
              key={product.id}
              product={product}
              variant="mart"
              adPlacement={adPlacement}
              width="100%"
              imageHeight={(rowIndex + columnIndex) % 2 === 0 ? TALL_IMAGE : SHORT_IMAGE}
              onPress={() => {
                void trackProductInteraction("product.clicked", { productId: product.id });
                navigation.navigate("ProductDetail", { productId: product.id });
              }}
              onAddToCart={() => addProductToCart.mutate({ productId: product.id, quantity: 1 })}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  column: { flex: 1, gap: 8 },
});
