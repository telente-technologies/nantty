import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";

import { ProductCard } from "@/components/product/productCard";
import { VariantPickerSheet } from "@/components/product/variantPickerSheet";
import { requireAuthThen } from "@/utils/requireAuth.util";
import { useCartActions } from "@/hooks/useCart.hook";
import { trackProductInteraction } from "@/services/sellers/productInteractions.service";
import type { AdPlacement, ProductSummary } from "@/types";

const TALL_IMAGE = 227;
const SHORT_IMAGE = 183;

export function ProductMasonry({ products, adPlacement = "mart", searchQuery, searchResultCount }: {
  products: readonly ProductSummary[];
  adPlacement?: AdPlacement;
  searchQuery?: string;
  searchResultCount?: number;
}) {
  const navigation = useNavigation();
  const { addProductToCart } = useCartActions();
  const [pickerProductId, setPickerProductId] = useState<string | null>(null);
  const columns: [ProductSummary[], ProductSummary[]] = [[], []];
  products.forEach((product, index) => columns[index % 2]!.push(product));

  const quickAdd = (product: ProductSummary) => {
    requireAuthThen(
      () => {
        if (product.hasVariants || (product.variantGroups?.length ?? 0) > 0) {
          setPickerProductId(product.id);
          return;
        }
        addProductToCart.mutate({ productId: product.id, quantity: 1 });
      },
      undefined,
      "add to cart",
    );
  };

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
                void trackProductInteraction("product.clicked", {
                  productId: product.id,
                  ...(adPlacement === "search" && searchQuery ? { surface: "search", query: searchQuery, resultCount: searchResultCount ?? 0 } : {}),
                });
                navigation.navigate("ProductDetail", { productId: product.id });
              }}
              onAddToCart={() => quickAdd(product)}
            />
          ))}
        </View>
      ))}
      <VariantPickerSheet
        productId={pickerProductId}
        onClose={() => setPickerProductId(null)}
        onAddedToCart={() => navigation.navigate("Cart")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  column: { flex: 1, gap: 8 },
});
