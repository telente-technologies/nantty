import { useState } from "react";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { maximumProductsPerClipRecommendationShelfContract } from "@nantty/contracts";

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

export type ProductRecommendationSurface = "for_you" | "mart_home" | "clips";

export const productsYouMightLikeQueryKey = (viewerId: string, surface: ProductRecommendationSurface = "for_you") => ["mart", "recommendations", surface, viewerId] as const;

export function useProductsYouMightLikeRecommendations({ enabled = true, surface = "for_you" }: { readonly enabled?: boolean; readonly surface?: ProductRecommendationSurface } = {}) {
  const viewerId = useAuthStore((state) => state.user?.id ?? "guest");
  return useQuery({
    // Recommendations are personalized server-side; never reuse one account's
    // cached response after an account switch in the same app session.
    queryKey: productsYouMightLikeQueryKey(viewerId, surface),
    queryFn: () => productsService.fetchProductsYouMightLike(surface),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export type ProductsYouMightLikeQuery = ReturnType<typeof useProductsYouMightLikeRecommendations>;

export function ProductsYouMightLike({
  recommendations: providedRecommendations,
  interactionSurface = "mart_recommendations",
  optional = false,
  presentation = "shelf",
  excludedProductIds = [],
}: {
  readonly recommendations?: ProductsYouMightLikeQuery;
  readonly interactionSurface?: "mart_recommendations" | "feed_recommendations" | "clips_recommendations";
  readonly optional?: boolean;
  readonly presentation?: "shelf" | "clips";
  readonly excludedProductIds?: readonly string[];
} = {}) {
  const styles = useStyles();
  const { width: windowWidth } = useWindowDimensions();
  const navigation = useNavigation();
  const [pickerProductId, setPickerProductId] = useState<string | null>(null);
  const internalRecommendations = useProductsYouMightLikeRecommendations({ enabled: providedRecommendations === undefined });
  const recommendations = providedRecommendations ?? internalRecommendations;
  const { addProductToCart } = useCartActions();
  const isClipsPresentation = presentation === "clips";
  const excludedProducts = new Set(excludedProductIds);
  const eligibleProducts = (recommendations.data?.products ?? []).filter((product) => !excludedProducts.has(product.id));
  const products = isClipsPresentation
    ? eligibleProducts.slice(0, maximumProductsPerClipRecommendationShelfContract)
    : eligibleProducts;
  const cardWidth = isClipsPresentation ? Math.min(320, Math.max(220, windowWidth * 0.74)) : CARD_WIDTH;
  const imageHeight = isClipsPresentation ? Math.round(cardWidth * 1.03) : 183;
  const sectionStyle = isClipsPresentation ? styles.clipsSection : styles.section;
  const cardsStyle = isClipsPresentation ? [styles.cards, styles.clipsCards] : styles.cards;
  const productCountLabel = products.length === 1 ? "product" : "products";

  if (optional && (recommendations.isLoading || recommendations.isError || products.length === 0)) return null;

  if (recommendations.isLoading) {
    return (
      <View style={sectionStyle} testID="productsYouMightLikeLoading" accessibilityState={{ busy: true }}>
        <Text size={18} weight={700}>Products you might like</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={cardsStyle}>
          {[0, 1, 2].map((item) => <View key={item} style={[styles.placeholder, isClipsPresentation ? { width: cardWidth, height: imageHeight } : null]} />)}
        </ScrollView>
      </View>
    );
  }

  if (recommendations.isError) {
    return (
      <View style={sectionStyle} testID="productsYouMightLikeError">
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
    <View style={sectionStyle} testID="productsYouMightLike" accessibilityLabel={`Products you might like, ${products.length} ${productCountLabel}`}>
      <Text size={18} weight={700}>Products you might like</Text>
      <ScrollView
        horizontal
        testID={isClipsPresentation ? "clipsProductRecommendationsCarousel" : undefined}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={cardsStyle}
        snapToInterval={isClipsPresentation ? cardWidth + 16 : undefined}
        snapToAlignment={isClipsPresentation ? "start" : undefined}
        decelerationRate={isClipsPresentation ? "fast" : undefined}
        nestedScrollEnabled={isClipsPresentation}
      >
        {products.map((product, position) => (
          <ProductCard
            key={product.id}
            product={product}
            variant="mart"
            width={cardWidth}
            imageHeight={imageHeight}
            adPlacement={isClipsPresentation ? "clips" : "feed"}
            onPress={() => {
              void trackProductInteraction("product.clicked", { productId: product.id, position, surface: interactionSurface });
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
  clipsSection: { flex: 1, justifyContent: "center", gap: 20, paddingVertical: 32 },
  clipsCards: { gap: 16, paddingHorizontal: 24 },
  placeholder: { width: CARD_WIDTH, height: 240, borderRadius: 4, backgroundColor: colors.skeleton },
}));
