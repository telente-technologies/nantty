"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { requireAuthThen } from "@/components/auth/authPrompt.store";
import { confirmFollowChange } from "@/components/follow/useFollowUser.hook";
import { ProductCard } from "@/components/commerce/productCard";
import { ProductGallery } from "@/components/commerce/productGallery";
import { ProductReviewsPreview } from "./productReviewsPreview";
import { CheckmarkBadge } from "@/components/verification/checkmarkBadge";
import { useProductInteraction } from "@/components/commerce/useProductInteraction.hook";
import { ContentActionsMenu } from "@/components/actions/contentActionsMenu";
import { ShareToChatButton } from "@/components/actions/shareToChatButton";
import { MentionText } from "@/components/mentions/mentionText";
import { SaveToggleButton } from "@/components/saves/saveToggleButton";
import { Button } from "@/components/ui/button";
import { ErrorState, Badge } from "@/components/ui/feedback";
import { Avatar } from "@/components/ui/media";
import { StarIcon, StoreIcon } from "@/components/ui/icons";
import { affiliateLinksService } from "@/services/affiliateLinks.service";
import { cartsService } from "@/services/carts.service";
import { productsService } from "@/services/products.service";
import { storesService } from "@/services/stores.service";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCountWithThousandsSuffix } from "@/utils/formatDate.util";
import { formatProductPriceForDisplay } from "@/utils/formatMoney.util";
import { followConfirmationCopy } from "@/utils/followToggle.util";
import { readSaleAttribution, rememberSaleAttribution } from "@/utils/saleAttribution.util";
import { buildProductPath, buildStorePath } from "@/utils/seoPaths.util";
import { findSelectedProductVariant, productPurchaseAvailability, readProductVariantGroups } from "@/utils/productVariants.util";
import type { BrandedProduct } from "@/types/brand.type";
import type { StoreDetail } from "@/types/commerce.type";

import controlStyles from "./buyBoxControls.module.css";
import styles from "./page.module.css";
import { ProductDetailSkeleton } from "./productDetailSkeleton";
import { IconLabel } from "@/components/ui/appIcon";

export function ProductDetailView({ productId, initialProduct }: { readonly productId: string; readonly initialProduct: BrandedProduct | null }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { track: trackInteraction, canTrack, viewerId } = useProductInteraction();
  const affiliateLinkId = useSearchParams().get("aff");

  useEffect(() => {
    if (!affiliateLinkId || !/^[A-Za-z0-9_-]{1,80}$/.test(affiliateLinkId)) return;
    affiliateLinksService.recordClick(affiliateLinkId).then(
      (click) => {
        if (click.productId === productId) rememberSaleAttribution(productId, click.attribution, Date.parse(click.expiresAt));
      },
      () => undefined,
    );
  }, [affiliateLinkId, productId]);

  const productQuery = useQuery({
    queryKey: ["products", "detail", productId],
    queryFn: () => productsService.fetchProductDetailById(productId),
    initialData: initialProduct ?? undefined,
    initialDataUpdatedAt: 0,
    retry: false,
  });

  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [variantSelections, setVariantSelections] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState<string | null>(null);
  const addToCartInFlight = useRef(false);
  const lastViewedKey = useRef<string | null>(null);

  useEffect(() => {
    const viewKey = `${viewerId ?? "guest"}:${productId}`;
    if (!productQuery.data || !canTrack || lastViewedKey.current === viewKey) return;
    lastViewedKey.current = viewKey;
    trackInteraction("product.viewed", { productId });
  }, [canTrack, productId, productQuery.data, trackInteraction, viewerId]);

  const addToCart = useMutation({
    mutationFn: () =>
      cartsService.addProductToCart({ productId, quantity, size: selectedSize, color: selectedColor, variants: variantSelections, attribution: readSaleAttribution(productId) }),
    onSuccess: async () => {
      setMessage("Added to cart.");
      trackInteraction("product.addedToCart", { productId, quantity });
      await queryClient.invalidateQueries({ queryKey: ["shell", "cart"] });
      await queryClient.invalidateQueries({ queryKey: ["cart"] });
    },
    onError: () => setMessage("Couldn't add to cart. Try again."),
  });

  const storeFollow = useMutation({
    mutationFn: (followNow: boolean) => (followNow ? storesService.followStore(productQuery.data!.store.id) : storesService.unfollowStore(productQuery.data!.store.id)),
    onMutate: async (followNow) => {
      const queryKey = ["products", "detail", productId] as const;
      const storeQueryKey = ["store", productQuery.data!.store.id] as const;
      await queryClient.cancelQueries({ queryKey });
      await queryClient.cancelQueries({ queryKey: storeQueryKey });
      const previousProduct = queryClient.getQueryData<BrandedProduct>(queryKey);
      const previousStore = queryClient.getQueryData<StoreDetail>(storeQueryKey);
      queryClient.setQueryData<BrandedProduct>(queryKey, (current) => current ? {
        ...current,
        store: {
          ...current.store,
          isFollowing: followNow,
        },
      } : current);
      queryClient.setQueryData<StoreDetail>(storeQueryKey, (current) => current ? {
        ...current,
        isFollowing: followNow,
        followers: Math.max(0, current.followers + (current.isFollowing === followNow ? 0 : followNow ? 1 : -1)),
      } : current);
      return { previousProduct, previousStore, queryKey, storeQueryKey };
    },
    onError: (_error, _followNow, context) => {
      if (context?.previousProduct) queryClient.setQueryData(context.queryKey, context.previousProduct);
      if (context?.previousStore) queryClient.setQueryData(context.storeQueryKey, context.previousStore);
      setMessage("Couldn't update this store. Check your connection and try again.");
    },
    onSuccess: (state, _followNow, context) => {
      queryClient.setQueryData<BrandedProduct>(context?.queryKey ?? ["products", "detail", productId], (current) => current ? {
        ...current,
        store: { ...current.store, isFollowing: state.isFollowing },
      } : current);
      queryClient.setQueryData<StoreDetail>(context?.storeQueryKey ?? ["store", productQuery.data!.store.id], (current) => current ? {
        ...current,
        isFollowing: state.isFollowing,
        followers: state.followers,
      } : current);
    },
  });

  if (productQuery.isLoading) return <ProductDetailSkeleton />;
  if (productQuery.isError || !productQuery.data) {
    return <ErrorState title="Product unavailable" description="This product may have been removed." error={productQuery.error} onRetry={() => void productQuery.refetch()} />;
  }

  const product = productQuery.data;
  const variantGroups = readProductVariantGroups(product.variantGroups, product.variants);
  const selectedVariant = findSelectedProductVariant(product, variantGroups, selectedSize, selectedColor, variantSelections);
  const needsOptionChoice = (product.sizes.length > 0 && !selectedSize)
    || (product.colors.length > 0 && !selectedColor)
    || variantGroups.some((group) => !variantSelections[group.name]);
  const purchaseAvailability = productPurchaseAvailability(product, selectedVariant, needsOptionChoice);
  const isOutOfStock = purchaseAvailability === "out_of_stock";

  function handleAddToCart(goToCart: boolean) {
    if (purchaseAvailability === "choose_options") {
      const missingGroup = variantGroups.find((group) => !variantSelections[group.name]);
      setMessage(missingGroup ? `Choose ${missingGroup.name} first.` : "Choose an option first.");
      return;
    }
    if (purchaseAvailability === "invalid_options") {
      setMessage("These options aren't available together.");
      return;
    }
    if (purchaseAvailability === "out_of_stock") {
      setMessage("This option is currently out of stock.");
      return;
    }
    if (addToCartInFlight.current) return;
    addToCartInFlight.current = true;
    setMessage(null);
    addToCart.mutate(undefined, {
      onSuccess: () => {
        if (goToCart) router.push("/checkout");
      },
      onSettled: () => {
        addToCartInFlight.current = false;
      },
    });
  }

  async function handleStoreFollow() {
    if (storeFollow.isPending) return;
    const copy = product.store.isFollowing ? followConfirmationCopy("unfollow", product.store.name) : null;
    if (copy !== null && !(await confirmFollowChange(copy))) return;
    setMessage(null);
    storeFollow.mutate(!product.store.isFollowing);
  }

  return (
    <div className={styles.page}>
      <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span aria-hidden="true">/</span>
        <Link href="/mart">Mart</Link>
        <span aria-hidden="true">/</span>
        <Link href={buildStorePath(product.store.id)}>{product.store.name}</Link>
        <span aria-hidden="true">/</span>
        <span className={styles.breadcrumbCurrent}>{product.title}</span>
      </nav>

      <div className={styles.layout}>
        <div className={styles.gallerySlot}>
          <ProductGallery images={product.images.length > 0 ? product.images : [product.imageUrl ?? ""]} name={product.title} priority />
        </div>

        <div className={styles.infoCard}>
          <div className={styles.brandRow}>
              {product.brand ? (
                <span className={styles.brandTag}>
                  <Avatar name={product.brand.name} src={product.brand.logoUrl} size="xs" />
                  {product.brand.name}
                </span>
              ) : null}
              <Link href={`/product/${encodeURIComponent(productId)}/reviews`} className={styles.rating} aria-label={product.rating > 0 ? `Rated ${product.rating.toFixed(1)} out of 5. See reviews` : "No ratings yet. See reviews"}>
                <StarIcon size={15} />
                {product.rating > 0 ? product.rating.toFixed(1) : "New"}
                <span>· Reviews</span>
              </Link>
            </div>

          <h1 className={styles.title}>{product.title}</h1>

            <p className={styles.price}>{formatProductPriceForDisplay(selectedVariant ?? product)}</p>
            {isOutOfStock ? <Badge tone="error">Out of stock</Badge> : product.promo ? <Badge tone="success">{product.promo}</Badge> : null}

            {product.sizes.length > 0 ? (
              <fieldset className={controlStyles.optionGroup}>
                <legend className={controlStyles.optionLabel}>Size</legend>
                <div className={controlStyles.options}>
                  {product.sizes.map((size) => (
                    <button
                      key={size}
                      type="button"
                      className={[controlStyles.option, selectedSize === size ? controlStyles.optionActive : ""].filter(Boolean).join(" ")}
                      aria-pressed={selectedSize === size}
                      onClick={() => setSelectedSize(size)}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </fieldset>
            ) : null}

            {product.colors.length > 0 ? (
              <fieldset className={controlStyles.optionGroup}>
                <legend className={controlStyles.optionLabel}>Colour</legend>
                <div className={controlStyles.options}>
                  {product.colors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={[controlStyles.option, selectedColor === color ? controlStyles.optionActive : ""].filter(Boolean).join(" ")}
                      aria-pressed={selectedColor === color}
                      onClick={() => setSelectedColor(color)}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </fieldset>
            ) : null}

            {variantGroups.map((group) => (
              <fieldset key={group.name} className={controlStyles.optionGroup}>
                <legend className={controlStyles.optionLabel}>{group.name}</legend>
                <div className={controlStyles.options}>
                  {group.options.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={[controlStyles.option, variantSelections[group.name] === option ? controlStyles.optionActive : ""].filter(Boolean).join(" ")}
                      aria-pressed={variantSelections[group.name] === option}
                      onClick={() => setVariantSelections((current) => ({ ...current, [group.name]: option }))}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </fieldset>
            ))}

            <div className={controlStyles.optionGroup}>
              <span className={controlStyles.optionLabel}>Quantity</span>
              <div className={controlStyles.quantity}>
                <button type="button" className={controlStyles.quantityButton} onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label="Decrease quantity">
                  −
                </button>
                <span className={controlStyles.quantityValue} aria-live="polite">
                  {quantity}
                </span>
                <button type="button" className={controlStyles.quantityButton} onClick={() => setQuantity((value) => Math.min(99, value + 1))} aria-label="Increase quantity">
                  +
                </button>
              </div>
            </div>

            {message ? (
              <p className={styles.notice} role="status">
                {message}
              </p>
            ) : null}

            <div className={styles.actions}>
              <Button size="lg" disabled={isOutOfStock} onClick={() => requireAuthThen(() => handleAddToCart(false), "Sign in to add items to your cart.")} busy={addToCart.isPending}>
                Add to cart
              </Button>
              <Button size="lg" variant="secondary" disabled={isOutOfStock} onClick={() => requireAuthThen(() => handleAddToCart(true), "Sign in to buy with escrow protection.")} busy={addToCart.isPending}>
                Buy now
              </Button>
            </div>

            <div className={styles.secondaryActions}>
              <SaveToggleButton targetType="product" targetId={product.id} initiallySaved={product.bookmarked ?? false} appearance="pill" saveCount={product.saveCount ?? 0} iconSize={18} />
              <ShareToChatButton kind="product" referenceId={product.id} className={styles.ghostAction} />
              <ContentActionsMenu shareKind={null} reportTargetType="product" targetId={product.id} canonicalPath={buildProductPath(product)} />
            </div>
        </div>

        <div className={styles.productDetails}>
          <section className={styles.panel}>
            <h2 className={styles.panelTitle}>Delivery</h2>
            <dl className={styles.specs}>
              <div>
                <dt>Delivery information</dt>
                <dd>{product.shippingInfo}</dd>
              </div>
            </dl>
            <p className={styles.shippingPolicyNote}>
              Delivery availability and cost are confirmed for your address at checkout. Seller delivery updates appear in Nantty; live courier tracking may not be available.
            </p>
          </section>

          {product.attributes?.some(({ name, value }) => name.trim() && value.trim()) ? (
            <section className={styles.panel} aria-labelledby="product-details-title">
              <h2 className={styles.panelTitle} id="product-details-title">Product details</h2>
              <dl className={styles.specs}>
                {product.attributes.filter(({ name, value }) => name.trim() && value.trim()).map(({ name, value }, index) => (
                  <div key={`${name}-${index}`}>
                    <dt>{name}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          <details className={[styles.panel, styles.descriptionPanel].join(" ")} open>
            <summary className={styles.descriptionSummary}>
              <h2 className={styles.panelTitle}>Description</h2>
              <span className={styles.descriptionChevron} aria-hidden="true" />
            </summary>
            <p className={styles.description}><MentionText text={product.description} /></p>
          </details>

          <ProductReviewsPreview productId={productId} />
        </div>

        <div className={styles.storeSection}>
          <Link href={buildStorePath(product.store.id)} className={styles.storeCard}>
            <Avatar name={product.store.name} src={product.store.logoUrl} size="lg" />
            <span className={styles.storeText}>
              <span className={styles.storeName}>
                <StoreIcon size={16} /> {product.store.name}
                {product.store.verification?.badgeVisible ? <CheckmarkBadge color={product.store.verification.color} /> : null}
              </span>
              <span className={styles.storeMeta}>
                <IconLabel name="star16" size={12}>{product.store.rating > 0 ? product.store.rating.toFixed(1) : "New"} · {formatCountWithThousandsSuffix(product.store.reviewCount)} reviews</IconLabel>
              </span>
              {product.store.earnBackBasisPoints ? <span className={styles.storeMeta}>Earn {product.store.earnBackBasisPoints / 100}% back at this store</span> : null}
            </span>
            <span className={styles.storeCta}>View store</span>
          </Link>
          <div className={styles.storeActions}>
            <Button
              size="sm"
              variant="secondary"
              busy={storeFollow.isPending}
              aria-pressed={product.store.isFollowing ?? false}
              onClick={() => requireAuthThen(() => void handleStoreFollow(), `Sign in to follow ${product.store.name}.`)}
            >
              {product.store.isFollowing ? "Following store" : "Follow store"}
            </Button>
          </div>
          {product.related.length > 0 ? (
            <section className={styles.panel}>
              <h2 className={styles.panelTitle}>You may also like</h2>
              <div className={styles.relatedGrid}>
                {product.related.map((related) => (
                  <ProductCard key={related.id} product={related} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
      <div className={styles.mobilePurchaseBar} role="group" aria-label="Purchase actions">
        <strong className={styles.mobilePurchasePrice}>{formatProductPriceForDisplay(selectedVariant ?? product)}</strong>
        {message ? <p className={styles.mobilePurchaseMessage} role="status">{message}</p> : null}
        <div className={styles.mobilePurchaseActions}>
          <Button
            size="md"
            variant="secondary"
            disabled={isOutOfStock}
            busy={addToCart.isPending}
            onClick={() => requireAuthThen(() => handleAddToCart(false), "Sign in to add items to your cart.")}
          >
            Add to cart
          </Button>
          <Button
            size="md"
            disabled={isOutOfStock}
            busy={addToCart.isPending}
            onClick={() => requireAuthThen(() => handleAddToCart(true), "Sign in to buy with escrow protection.")}
          >
            Buy now
          </Button>
        </div>
      </div>
    </div>
  );
}
