import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ActivityIndicator, ScrollView, Share, StyleSheet, View } from "react-native";

import { Frame69424Icon } from "@/components/icons";
import { AboutShopCard } from "@/components/product/aboutShopCard";
import { FeaturedProductsGrid } from "@/components/product/featuredProductsGrid";
import { OptionSelect } from "@/components/product/optionSelect";
import { ProductGallery } from "@/components/product/productGallery";
import { ProductInfoSection } from "@/components/product/productInfoSection";
import { ProductPriceBlock } from "@/components/product/productPriceBlock";
import { Button } from "@/components/ui/button";
import { Header, HeaderAction } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import { useCartActions } from "@/hooks/useCart.hook";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { productsService } from "@/services/products.service";
import { storesService } from "@/services/stores.service";

const QUANTITY_OPTIONS = Array.from({ length: 10 }, (_, i) => String(i + 1));

export function ProductDetailScreen({ navigation, route }: MainScreenProps<"ProductDetail">) {
  const { productId } = route.params;
  const product = useQuery({ queryKey: ["products", "detail", productId], queryFn: () => productsService.fetchProductDetailById(productId) });
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [bookmarked, setBookmarked] = useState(false);
  const [followingShop, setFollowingShop] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);
  const { addProductToCart } = useCartActions();

  const toggleShopFollow = useMutation({
    mutationFn: (followNow: boolean) =>
      followNow ? storesService.followStore(product.data!.store.id) : storesService.unfollowStore(product.data!.store.id),
    onMutate: (followNow) => setFollowingShop(followNow),
    onError: (_error, followNow) => setFollowingShop(!followNow),
  });

  const addSelectedProductToCart = async () => {
    const detail = product.data;
    if (!detail) return;
    if ((detail.sizes.length > 0 && !selectedSize) || (detail.colors.length > 0 && !selectedColor)) {
      setCartError("Choose a size and color first.");
      return;
    }
    setCartError(null);
    try {
      await addProductToCart.mutateAsync({ productId, quantity, size: selectedSize, color: selectedColor });
      navigation.navigate("Cart");
    } catch {
      setCartError("Couldn't add to cart. Try again.");
    }
  };

  const bookmarkProduct = async () => {
    setBookmarked((value) => !value);
    await productsService.bookmarkProduct(productId).catch(() => setBookmarked((value) => !value));
  };

  const header = (
    <Header
      paddingHorizontal={12}
      right={
        <HeaderAction label="Search" onPress={() => navigation.navigate("Search", { scope: "mart" })}>
          <Frame69424Icon />
        </HeaderAction>
      }
    />
  );

  if (!product.data) {
    return (
      <Screen>
        {header}
        {product.isError ? (
          <Text align="center" color={colors.textSubtle} style={styles.state}>
            Couldn't load this product.
          </Text>
        ) : (
          <ActivityIndicator style={styles.state} color={colors.primary} />
        )}
      </Screen>
    );
  }

  const detail = product.data;
  return (
    <Screen>
      {header}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.gallery}>
          <ProductGallery images={detail.images} promo={detail.promo} />
        </View>
        <ProductPriceBlock
          product={detail}
          bookmarked={bookmarked}
          onShare={() => Share.share({ message: `${detail.name} on Zudomart: https://zudomart.com/products/${detail.id}` })}
          onToggleBookmark={bookmarkProduct}
          onPressRating={() => navigation.navigate("ProductReviews", { productId })}
        />
        <View style={styles.selectors}>
          <OptionSelect label="Size" placeholder="Size (UK)" options={detail.sizes} value={selectedSize} onChange={setSelectedSize} />
          <OptionSelect label="Color" placeholder="Select an option" options={detail.colors} value={selectedColor} onChange={setSelectedColor} />
          <OptionSelect
            label="Quantity"
            placeholder="Number of items"
            options={QUANTITY_OPTIONS}
            value={String(quantity)}
            trailingValue={String(quantity)}
            onChange={(value) => setQuantity(Number(value))}
          />
        </View>
        <View style={styles.divider} />
        <View style={styles.info}>
          <ProductInfoSection title="Shipping & returns" body={detail.shippingInfo} />
          <ProductInfoSection title="Description" body={detail.description} collapsible />
        </View>
        <View style={styles.divider} />
        <View style={styles.shop}>
          <AboutShopCard
            store={detail.store}
            following={followingShop}
            onToggleFollow={() => toggleShopFollow.mutate(!followingShop)}
            onViewShop={() => navigation.navigate("Store", { storeId: detail.store.id })}
          />
          <FeaturedProductsGrid products={detail.related} />
        </View>
      </ScrollView>
      <View style={styles.bottomBar}>
        {cartError ? (
          <Text size={12} lineHeight={14.4} color={colors.error} align="center" accessibilityRole="alert">
            {cartError}
          </Text>
        ) : null}
        <Button title="Add to Cart" loading={addProductToCart.isPending} onPress={addSelectedProductToCart} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  state: { marginTop: 64 },
  content: { paddingBottom: 21 },
  gallery: { marginTop: 8 },
  selectors: { paddingHorizontal: 12, marginTop: 24, gap: 12 },
  divider: { height: 4, backgroundColor: colors.placeholder, marginVertical: 12 },
  info: { paddingHorizontal: 12, gap: 18, marginTop: 4 },
  shop: { marginTop: 4, gap: 23 },
  bottomBar: {
    padding: 12,
    gap: 8,
    backgroundColor: colors.background,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 12,
  },
});
