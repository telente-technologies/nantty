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

export function useProductsYouMightLikeRecommendations({ enabled = true }: { readonly enabled?: boolean } = {}) {
  const viewerId = useAuthStore((state) => state.user?.id ?? "guest");
  return useQuery({
    // Recommendations are personalized server-side; never reuse one account's
    // cached response after an account switch in the same app session.
    queryKey: productsYouMightLikeQueryKey(viewerId),
    queryFn: productsService.fetchProductsYouMightLike,
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

type ProductsYouMightLikeQuery = ReturnType<typeof useProductsYouMightLikeRecommendations>;

export function ProductsYouMightLike({
  recommendations: providedRecommendations,
  interactionSurface = "mart_recommendations",
  optional = false,
}: {
  readonly recommendations?: ProductsYouMightLikeQuery;
  readonly interactionSurface?: "mart_recommendations" | "feed_recommendations";
  readonly optional?: boolean;
} = {}) {
  const styles = useStyles();
  const navigation = useNavigation();
  const [pickerProductId, setPickerProductId] = useState<string | null>(null);
  const internalRecommendations = useProductsYouMightLikeRecommendations({ enabled: providedRecommendations === undefined });
  const recommendations = providedRecommendations ?? internalRecommendations;
  const { addProductToCart } = useCartActions();
  const products = recommendations.data?.products ?? [];

  if (optional && (recommendations.isLoading || recommendations.isError || products.length === 0)) return null;

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
              void trackProductInteraction("product.clicked", { productId: product.id, surface: interactionSurface });
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
