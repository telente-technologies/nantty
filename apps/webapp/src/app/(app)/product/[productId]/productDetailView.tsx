"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { requireAuthThen } from "@/components/auth/authPrompt.store";
import { ProductCard } from "@/components/commerce/productCard";
import { ProductGallery } from "@/components/commerce/productGallery";
import { ContentActionsMenu } from "@/components/actions/contentActionsMenu";
import { ShareToChatButton } from "@/components/actions/shareToChatButton";
import { SaveToggleButton } from "@/components/saves/saveToggleButton";
import { Button } from "@/components/ui/button";
import { RetryButton } from "@/components/ui/controls";
import { ErrorState, Badge } from "@/components/ui/feedback";
import { Avatar } from "@/components/ui/media";
import { StarIcon, StoreIcon } from "@/components/ui/icons";
import { cartsService } from "@/services/carts.service";
import { productsService } from "@/services/products.service";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCountWithThousandsSuffix } from "@/utils/formatDate.util";
import { formatProductPriceForDisplay } from "@/utils/formatMoney.util";
import { buildProductPath, buildStorePath } from "@/utils/seoPaths.util";
import type { BrandedProduct } from "@/types/brand.type";

import controlStyles from "./buyBoxControls.module.css";
import styles from "./page.module.css";
import { ProductDetailSkeleton } from "./productDetailSkeleton";
import { IconLabel } from "@/components/ui/appIcon";

export function ProductDetailView({ productId, initialProduct }: { readonly productId: string; readonly initialProduct: BrandedProduct | null }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const productQuery = useQuery({
    queryKey: ["products", "detail", productId],
    queryFn: () => productsService.fetchProductDetailById(productId),
    initialData: initialProduct ?? undefined,
    initialDataUpdatedAt: 0,
    retry: false,
  });

  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState<string | null>(null);
  const addToCartInFlight = useRef(false);

  const addToCart = useMutation({
    mutationFn: () =>
      cartsService.addProductToCart({ productId, quantity, size: selectedSize, color: selectedColor }),
    onSuccess: async () => {
      setMessage("Added to cart.");
      await queryClient.invalidateQueries({ queryKey: ["shell", "cart"] });
      await queryClient.invalidateQueries({ queryKey: ["cart"] });
    },
    onError: () => setMessage("Couldn't add to cart. Try again."),
  });

  if (productQuery.isLoading) return <ProductDetailSkeleton />;
  if (productQuery.isError || !productQuery.data) {
    return <ErrorState title="Product unavailable" description="This product may have been removed." action={<RetryButton onRetry={() => productQuery.refetch()} />} />;
  }

  const product = productQuery.data;
  const needsOptionChoice = (product.sizes.length > 0 && !selectedSize) || (product.colors.length > 0 && !selectedColor);

  function handleAddToCart(goToCart: boolean) {
    if (needsOptionChoice) {
      setMessage("Choose an option first.");
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
        <div className={styles.left}>
          <ProductGallery images={product.images.length > 0 ? product.images : [product.imageUrl ?? ""]} name={product.title} priority />

          <section className={styles.panel}>
            <h2 className={styles.panelTitle}>Description</h2>
            <p className={styles.description}>{product.description}</p>
            <dl className={styles.specs}>
              <div>
                <dt>Shipping</dt>
                <dd>{product.shippingInfo}</dd>
              </div>
            </dl>
          </section>

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

        <div className={styles.right}>
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

            <p className={styles.price}>{formatProductPriceForDisplay(product)}</p>
            {product.promo ? <Badge tone="success">{product.promo}</Badge> : null}

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
              <Button size="lg" onClick={() => requireAuthThen(() => handleAddToCart(false), "Sign in to add items to your cart.")} busy={addToCart.isPending}>
                Add to cart
              </Button>
              <Button size="lg" variant="secondary" onClick={() => requireAuthThen(() => handleAddToCart(true), "Sign in to buy with escrow protection.")} busy={addToCart.isPending}>
                Buy now
              </Button>
            </div>

            <div className={styles.secondaryActions}>
              <SaveToggleButton targetType="product" targetId={product.id} initiallySaved={product.bookmarked ?? false} appearance="pill" saveCount={product.saveCount ?? 0} iconSize={18} />
              <ShareToChatButton kind="product" referenceId={product.id} className={styles.ghostAction} />
              <ContentActionsMenu shareKind={null} reportTargetType="product" targetId={product.id} canonicalPath={buildProductPath(product)} />
            </div>
          </div>

          <Link href={buildStorePath(product.store.id)} className={styles.storeCard}>
            <Avatar name={product.store.name} src={product.store.logoUrl} size="lg" />
            <span className={styles.storeText}>
              <span className={styles.storeName}>
                <StoreIcon size={16} /> {product.store.name}
              </span>
              <span className={styles.storeMeta}>
                <IconLabel name="star16" size={12}>{product.store.rating > 0 ? product.store.rating.toFixed(1) : "New"} · {formatCountWithThousandsSuffix(product.store.reviewCount)} reviews</IconLabel>
              </span>
              {product.store.earnBackBasisPoints ? <span className={styles.storeMeta}>Earn {product.store.earnBackBasisPoints / 100}% back at this store</span> : null}
            </span>
            <span className={styles.storeCta}>View store</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
