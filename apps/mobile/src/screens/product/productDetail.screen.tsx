import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ScrollView, Share, StyleSheet, View } from "react-native";

import { affiliateLinksService } from "@/services/commerce/affiliateLinks.service";
import { rememberSaleAttribution } from "@/store/saleAttribution.store";
import { isAffiliateLinkId } from "@/utils/saleAttribution.util";
import { useShareToChat } from "@/components/chatSafety/shareToChat.hook";
import { Frame69424Icon } from "@/components/icons";
import { AboutShopCard } from "@/components/product/aboutShopCard";
import { FeaturedProductsGrid } from "@/components/product/featuredProductsGrid";
import { OptionSelect } from "@/components/product/optionSelect";
import { ProductGallery } from "@/components/product/productGallery";
import { ProductInfoSection } from "@/components/product/productInfoSection";
import { ProductBrandRow } from "@/components/product/productBrandRow";
import { ProductPriceBlock } from "@/components/product/productPriceBlock";
import { ReportProductSheet } from "@/components/product/reportProductSheet";
import { useConfirmedFollowToggle } from "@/components/profile/confirmedFollowToggle.hook";
import { ProductReviewsSection } from "@/components/reviews/productReviewsSection";
import { Button } from "@/components/ui/button";
import { Header, HeaderAction } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { useCartActions } from "@/hooks/useCart.hook";
import { useSaveToggle } from "@/hooks/useSaveToggle.hook";
import { requireAuthThen } from "@/utils/requireAuth.util";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { trackProductInteraction } from "@/services/sellers/productInteractions.service";
import { productsService } from "@/services/sellers/products.service";
import { ApiError } from "@/services/core/apiClient.service";
import { storesService } from "@/services/sellers/stores.service";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { ErrorState } from "@/components/ui/errorState";
import { webAppLinks } from "@/config/webAppLinks.config";

const QUANTITY_OPTIONS = Array.from({ length: 10 }, (_, i) => String(i + 1));

export function ProductDetailScreen({ navigation, route }: MainScreenProps<"ProductDetail">) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { productId, aff: affiliateLinkId } = route.params;
  const product = useQuery({ queryKey: ["products", "detail", productId], queryFn: () => productsService.fetchProductDetailById(productId) });
  useEffect(() => {
    if (!isAffiliateLinkId(affiliateLinkId)) return;
    affiliateLinksService.recordClick(affiliateLinkId).then(
      (click) => {
        if (click.productId === productId) rememberSaleAttribution(productId, click.attribution, Date.parse(click.expiresAt));
      },
      () => undefined,
    );
  }, [affiliateLinkId, productId]);
  useEffect(() => {
    void trackProductInteraction("product.viewed", { productId });
  }, [productId]);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [variantSelections, setVariantSelections] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const { offerSendInChat, sendInChatElement } = useShareToChat();
  const productSave = useSaveToggle({ type: "product", targetId: productId }, product.data?.savedByViewer ?? false);
  const [followingShop, setFollowingShop] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);
  const [reportSheetVisible, setReportSheetVisible] = useState(false);
  const { addProductToCart } = useCartActions();

  const { toggle: toggleFollow } = useConfirmedFollowToggle();

  const addSelectedProductToCart = () => {
    const detail = product.data;
    if (!detail) return;
    if (detail.sizes.length > 0 && !selectedSize) {
      setCartError("Choose a size first.");
      return;
    }
    if (detail.colors.length > 0 && !selectedColor) {
      setCartError("Choose a color first.");
      return;
    }
    const missingGroup = (detail.variantGroups ?? []).find((group) => !variantSelections[group.name]);
    if (missingGroup) {
      setCartError(`Choose ${missingGroup.name} first.`);
      return;
    }
    setCartError(null);
    requireAuthThen(addValidatedProductToCart, undefined, "add to cart");
  };

  const addValidatedProductToCart = async () => {
    try {
      await addProductToCart.mutateAsync({
        productId,
        quantity,
        size: selectedSize,
        color: selectedColor,
        variants: Object.keys(variantSelections).length > 0 ? variantSelections : null,
      });
      navigation.navigate("Cart");
    } catch {
      setCartError("Couldn't add to cart. Try again.");
    }
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
          product.error instanceof ApiError && product.error.code === "PRODUCT_NOT_AVAILABLE_IN_REGION" ? (
            <ErrorState kind="regionUnavailable" />
          ) : (
            <ErrorState error={product.error} message="Couldn't load this product." onRetry={() => product.refetch()} />
          )
        ) : (
          <ListSkeleton />
        )}
      </Screen>
    );
  }

  const detail = product.data;
  return (
    <Screen>
      {header}
      {sendInChatElement}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.gallery}>
          <ProductGallery images={detail.images} promo={detail.promo} />
        </View>
        <ProductPriceBlock
          product={detail}
          bookmarked={productSave.isSaved}
          saveCount={(detail.saveCount ?? 0) + productSave.savedDelta}
          onShare={() => offerSendInChat({ kind: "product", id: detail.id }, () => Share.share({ message: `${detail.name} on Nantty: ${webAppLinks.product(detail)}` }))}
          onToggleBookmark={productSave.toggleSaved}
          onPressRating={() => navigation.navigate("ProductReviews", { productId })}
        />
        {detail.brand ? (
          <ProductBrandRow brand={detail.brand} isOfficialStore={detail.isOfficialStore ?? false} onPress={() => navigation.navigate("BrandProfile", { brandId: detail.brand!.id })} />
        ) : null}
        <View style={styles.selectors}>
          {detail.sizes.length > 0 ? <OptionSelect label="Size" placeholder="Size (UK)" options={detail.sizes} value={selectedSize} onChange={setSelectedSize} /> : null}
          {detail.colors.length > 0 ? <OptionSelect label="Color" placeholder="Select an option" options={detail.colors} value={selectedColor} onChange={setSelectedColor} /> : null}
          {(detail.variantGroups ?? []).map((group) => (
            <OptionSelect
              key={group.name}
              label={group.name}
              placeholder={`Select ${group.name.toLowerCase()}`}
              options={group.options}
              value={variantSelections[group.name] ?? null}
              onChange={(value) => setVariantSelections((prev) => ({ ...prev, [group.name]: value }))}
            />
          ))}
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
        <ProductReviewsSection productId={productId} onSeeAll={() => navigation.navigate("ProductReviews", { productId })} />
        <View style={styles.divider} />
        <View style={styles.shop}>
          <AboutShopCard
            store={detail.store}
            following={followingShop}
            onToggleFollow={() => requireAuthThen(() => toggleFollow({
              subjectLabel: detail.store.name, state: followingShop ? "accepted" : "none", apply: (state) => setFollowingShop(state === "accepted"),
              follow: () => storesService.followStore(detail.store.id), unfollow: () => storesService.unfollowStore(detail.store.id),
            }), undefined, "follow shops")}
            onViewShop={() => navigation.navigate("Store", { storeId: detail.store.id })}
          />
          <FeaturedProductsGrid products={detail.related} />
          <Text size={13} weight={500} lineHeight={16.9} color={colors.textMuted} align="center" accessibilityRole="button" onPress={() => requireAuthThen(() => setReportSheetVisible(true), undefined, "report")}>
            Report this product
          </Text>
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
      <ReportProductSheet productId={productId} visible={reportSheetVisible} onClose={() => setReportSheetVisible(false)} />
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
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
}));
