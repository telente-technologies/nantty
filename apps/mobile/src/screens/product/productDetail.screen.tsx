import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ScrollView, Share, StyleSheet, View } from "react-native";

import { affiliateLinksService } from "@/services/commerce/affiliateLinks.service";
import { rememberSaleAttribution } from "@/store/saleAttribution.store";
import { isAffiliateLinkId } from "@/utils/saleAttribution.util";
import { useShareToChat } from "@/components/chatSafety/shareToChat.hook";
import { Frame69424Icon } from "@/components/icons";
import { AboutShopCard } from "@/components/product/aboutShopCard";
import { FeaturedProductsGrid } from "@/components/product/featuredProductsGrid";
import { ProductAttributesSection } from "@/components/product/productAttributesSection";
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
import { useAuthStore } from "@/store/auth.store";
import { requireAuthThen } from "@/utils/requireAuth.util";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { trackProductInteraction } from "@/services/sellers/productInteractions.service";
import { productsService } from "@/services/sellers/products.service";
import { savesService } from "@/services/social/saves.service";
import { ApiError } from "@/services/core/apiClient.service";
import { storesService } from "@/services/sellers/stores.service";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { ErrorState } from "@/components/ui/errorState";
import { webAppLinks } from "@/config/webAppLinks.config";
import { findSelectedProductVariant, productPurchaseAvailability, readProductVariantGroups } from "@/utils/productVariants.util";
import type { BrandedProduct } from "@/types/brand.type";
import type { StoreDetail } from "@/types/commerce.type";

// Keep the picker within the cart API's accepted 1..99 line-quantity range.
const QUANTITY_OPTIONS = Array.from({ length: 99 }, (_, i) => String(i + 1));

export function ProductDetailScreen({ navigation, route }: MainScreenProps<"ProductDetail">) {
  const { colors } = useTheme();
  const styles = useStyles();
  const queryClient = useQueryClient();
  const isSignedIn = useAuthStore((state) => state.status === "signedIn");
  const viewerId = useAuthStore((state) => state.user?.id ?? null);
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
  const lastViewedKey = useRef<string | null>(null);
  useEffect(() => {
    if (product.data?.id !== productId) return;
    const viewKey = `${viewerId ?? "guest"}:${productId}`;
    if (lastViewedKey.current === viewKey) return;
    lastViewedKey.current = viewKey;
    void trackProductInteraction("product.viewed", { productId });
  }, [product.data?.id, productId, viewerId]);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [variantSelections, setVariantSelections] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const { offerSendInChat, sendInChatElement } = useShareToChat();
  const saveTarget = { type: "product" as const, targetId: productId };
  const productSaveStatus = useQuery({
    queryKey: ["saves", "status", saveTarget.type, productId],
    queryFn: () => savesService.fetchSaveStatus(saveTarget),
    enabled: isSignedIn && !!product.data,
  });
  const productSave = useSaveToggle(saveTarget, productSaveStatus.data?.isSaved ?? product.data?.savedByViewer ?? false);
  const [followingShopOverride, setFollowingShopOverride] = useState<{ readonly productId: string; readonly isFollowing: boolean } | null>(null);
  const followingShop = (followingShopOverride?.productId === productId ? followingShopOverride.isFollowing : null)
    ?? product.data?.store.isFollowing
    ?? false;
  const [cartError, setCartError] = useState<string | null>(null);
  const [reportSheetVisible, setReportSheetVisible] = useState(false);
  const { addProductToCart } = useCartActions();

  const { toggle: toggleFollow } = useConfirmedFollowToggle();

  const applyStoreFollowState = (isFollowing: boolean, followers?: number) => {
    setFollowingShopOverride({ productId, isFollowing });
    queryClient.setQueryData<BrandedProduct>(["products", "detail", productId], (current) => current
      ? { ...current, store: {
        ...current.store,
        isFollowing,
      } }
      : current);
    const storeId = product.data?.store.id;
    if (storeId) {
      queryClient.setQueryData<StoreDetail>(["stores", storeId], (current) => current ? {
        ...current,
        isFollowing,
        followers: followers ?? Math.max(0, current.followers + (current.isFollowing === isFollowing ? 0 : isFollowing ? 1 : -1)),
      } : current);
    }
  };

  const addSelectedProductToCart = (destination: "cart" | "checkout") => {
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
    const missingGroup = readProductVariantGroups(detail.variantGroups, detail.variants).find((group) => !variantSelections[group.name]);
    if (missingGroup) {
      setCartError(`Choose ${missingGroup.name} first.`);
      return;
    }
    const selectedVariant = findSelectedProductVariant(detail, readProductVariantGroups(detail.variantGroups, detail.variants), selectedSize, selectedColor, variantSelections);
    const purchaseAvailability = productPurchaseAvailability(detail, selectedVariant, false);
    if (purchaseAvailability === "invalid_options") {
      setCartError("These options aren't available together.");
      return;
    }
    if (purchaseAvailability === "out_of_stock") {
      setCartError("This option is currently out of stock.");
      return;
    }
    setCartError(null);
    requireAuthThen(() => addValidatedProductToCart(destination), undefined, destination === "checkout" ? "buy now" : "add to cart");
  };

  const addValidatedProductToCart = async (destination: "cart" | "checkout") => {
    try {
      await addProductToCart.mutateAsync({
        productId,
        quantity,
        size: selectedSize,
        color: selectedColor,
        variants: Object.keys(variantSelections).length > 0 ? variantSelections : null,
      });
      navigation.navigate(destination === "checkout" ? "Checkout" : "Cart");
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
  const variantGroups = readProductVariantGroups(detail.variantGroups, detail.variants);
  const selectedVariant = findSelectedProductVariant(detail, variantGroups, selectedSize, selectedColor, variantSelections);
  const needsOptionChoice = (detail.sizes.length > 0 && !selectedSize)
    || (detail.colors.length > 0 && !selectedColor)
    || variantGroups.some((group) => !variantSelections[group.name]);
  const purchaseAvailability = productPurchaseAvailability(detail, selectedVariant, needsOptionChoice);
  const isOutOfStock = purchaseAvailability === "out_of_stock";
  return (
    <Screen>
      {header}
      {sendInChatElement}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.gallery}>
          <ProductGallery images={detail.images} fallbackImageUrl={detail.imageUrl} promo={detail.promo} />
        </View>
        <ProductPriceBlock
          product={selectedVariant ? { ...detail, price: selectedVariant.price, approxPrice: selectedVariant.approxPrice ?? null } : detail}
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
          {variantGroups.map((group) => (
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
          <ProductInfoSection
            title="Delivery"
            body={detail.shippingInfo}
            note="Delivery availability and cost are confirmed for your address at checkout. Seller delivery updates appear in Nantty; live courier tracking may not be available."
          />
          <ProductAttributesSection attributes={detail.attributes ?? []} />
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
              subjectLabel: detail.store.name,
              state: followingShop ? "accepted" : "none",
              apply: (state) => applyStoreFollowState(state === "accepted"),
              follow: async () => {
                const result = await storesService.followStore(detail.store.id);
                applyStoreFollowState(result.isFollowing, result.followers);
                return { state: result.isFollowing ? "accepted" : "none" };
              },
              unfollow: async () => {
                const result = await storesService.unfollowStore(detail.store.id);
                applyStoreFollowState(result.isFollowing, result.followers);
                return { state: result.isFollowing ? "accepted" : "none" };
              },
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
        {isOutOfStock ? (
          <Text size={12} lineHeight={14.4} color={colors.error} align="center" accessibilityRole="alert">
            Out of stock
          </Text>
        ) : null}
        {cartError ? (
          <Text size={12} lineHeight={14.4} color={colors.error} align="center" accessibilityRole="alert">
            {cartError}
          </Text>
        ) : null}
        <View style={styles.purchaseActions}>
          <Button
            title="Add to Cart"
            variant="subtle"
            loading={addProductToCart.isPending}
            disabled={isOutOfStock}
            onPress={() => addSelectedProductToCart("cart")}
            style={styles.purchaseAction}
          />
          <Button
            title="Buy now"
            loading={addProductToCart.isPending}
            disabled={isOutOfStock}
            onPress={() => addSelectedProductToCart("checkout")}
            style={styles.purchaseAction}
          />
        </View>
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
  purchaseActions: { flexDirection: "row", gap: 8 },
  purchaseAction: { flex: 1 },
}));
