import { useState } from "react";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { ScrollView, StyleSheet, View } from "react-native";

import { ProductCard } from "@/components/product/productCard";
import { VariantPickerSheet } from "@/components/product/variantPickerSheet";
import { ErrorState } from "@/components/ui/errorState";
import { Text } from "@/components/ui/text";
import { useCartActions } from "@/hooks/useCart.hook";
import { productsService } from "@/services/sellers/products.service";
import { trackProductInteraction } from "@/services/sellers/productInteractions.service";
import { useAuthStore } from "@/store/auth.store";
import { makeThemedStyles } from "@/theme";
import type { ProductSummary } from "@/types";
import { requireAuthThen } from "@/utils/requireAuth.util";

const CARD_WIDTH = 160;

export const productsYouMightLikeQueryKey = (viewerId: string) => ["mart", "recommendations", "for-you", viewerId] as const;

export function ProductsYouMightLike() {
  const styles = useStyles();
  const navigation = useNavigation();
  const viewerId = useAuthStore((state) => state.user?.id ?? "guest");
  const [pickerProductId, setPickerProductId] = useState<string | null>(null);
  const recommendations = useQuery({
    // Recommendations are personalized server-side; never reuse one account's
    // cached response after an account switch in the same app session.
    queryKey: productsYouMightLikeQueryKey(viewerId),
    queryFn: productsService.fetchProductsYouMightLike,
    staleTime: 5 * 60 * 1000,
  });
  const { addProductToCart } = useCartActions();
  const products = recommendations.data?.products ?? [];

  if (recommendations.isLoading) {
    return (
      <View style={styles.section} testID="productsYouMightLikeLoading" accessibilityState={{ busy: true }}>
        <Text size={18} weight={700}>Products you might like</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards}>
          {[0, 1, 2].map((item) => <View key={item} style={styles.placeholder} />)}
        </ScrollView>
      </View>
    );
  }

  if (recommendations.isError) {
    return (
      <View style={styles.section} testID="productsYouMightLikeError">
        <Text size={18} weight={700}>Products you might like</Text>
        <ErrorState
          error={recommendations.error}
          variant="inline"
          message="Couldn't load product recommendations."
          onRetry={() => { void recommendations.refetch(); }}
          retrying={recommendations.isRefetching}
        />
      </View>
    );
  }

  if (products.length === 0) return null;

  const addToCart = (product: ProductSummary) => requireAuthThen(() => {
    if (product.hasVariants || (product.variantGroups?.length ?? 0) > 0) {
      setPickerProductId(product.id);
      return;
    }
    addProductToCart.mutate({ productId: product.id, quantity: 1 });
  }, undefined, "add to cart");

  return (
    <View style={styles.section} testID="productsYouMightLike" accessibilityLabel={`Products you might like, ${products.length} products`}>
      <Text size={18} weight={700}>Products you might like</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards}>
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            variant="mart"
            width={CARD_WIDTH}
            imageHeight={183}
            onPress={() => {
              void trackProductInteraction("product.clicked", { productId: product.id, surface: "mart_recommendations" });
              navigation.navigate("ProductDetail", { productId: product.id });
            }}
            onAddToCart={() => addToCart(product)}
          />
        ))}
      </ScrollView>
      <VariantPickerSheet
        productId={pickerProductId}
        onClose={() => setPickerProductId(null)}
        onAddedToCart={() => navigation.navigate("Cart")}
      />
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  section: { gap: 12, paddingVertical: 16 },
  cards: { gap: 12, paddingHorizontal: 1 },
  placeholder: { width: CARD_WIDTH, height: 240, borderRadius: 4, backgroundColor: colors.skeleton },
}));
