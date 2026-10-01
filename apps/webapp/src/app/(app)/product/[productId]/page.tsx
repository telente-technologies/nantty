"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState } from "react";

import { ProductCard } from "@/components/commerce/productCard";
import { Button } from "@/components/ui/button";
import { RetryButton } from "@/components/ui/controls";
import { ErrorState, Spinner, Badge } from "@/components/ui/feedback";
import { Avatar, MediaImage } from "@/components/ui/media";
import { HeartIcon, ShareIcon, StarIcon, StoreIcon } from "@/components/ui/icons";
import { cartsService } from "@/services/carts.service";
import { productsService } from "@/services/products.service";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCountWithThousandsSuffix } from "@/utils/formatDate.util";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

import styles from "./page.module.css";

function ProductGallery({ images, name, priority }: { readonly images: readonly string[]; readonly name: string; readonly priority: boolean }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const shown = images.filter(Boolean);
  const active = shown[activeIndex];

  if (shown.length === 0) {
    return <div className={styles.galleryEmpty} aria-hidden="true" />;
  }

  return (
    <div className={styles.gallery}>
      <div className={styles.galleryMain}>
        <MediaImage src={active} alt={name} sizes="(max-width: 900px) 100vw, 640px" priority={priority} />
      </div>
      {shown.length > 1 ? (
        <div className={styles.thumbnails} role="tablist" aria-label="Product images">
          {shown.map((image, index) => (
            <button
              key={image}
              type="button"
              role="tab"
              aria-selected={index === activeIndex}
              className={[styles.thumbnail, index === activeIndex ? styles.thumbnailActive : ""].filter(Boolean).join(" ")}
              onClick={() => setActiveIndex(index)}
            >
              <MediaImage src={image} alt={`View ${index + 1}`} sizes="80px" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function ProductDetailPage({ params }: { readonly params: Promise<{ readonly productId: string }> }) {
  const { productId } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

  const productQuery = useQuery({
    queryKey: ["products", "detail", productId],
    queryFn: () => productsService.fetchProductDetailById(productId),
    retry: false,
  });

  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState<string | null>(null);

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

  if (productQuery.isLoading) return <Spinner label="Loading product" />;
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
    setMessage(null);
    addToCart.mutate(undefined, {
      onSuccess: () => {
        if (goToCart) router.push("/cart");
      },
    });
  }

  return (
    <div className={styles.page}>
      <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span aria-hidden="true">/</span>
        <Link href={`/store/${product.store.id}`}>{product.store.name}</Link>
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
              <span className={styles.rating}>
                <StarIcon size={15} />
                {product.rating > 0 ? product.rating.toFixed(1) : "New"}
              </span>
            </div>

            <h1 className={styles.title}>{product.title}</h1>

            <p className={styles.price}>{formatMoneyForDisplay(product.price)}</p>
            {product.promo ? <Badge tone="success">{product.promo}</Badge> : null}

            {product.sizes.length > 0 ? (
              <fieldset className={styles.optionGroup}>
                <legend className={styles.optionLabel}>Size</legend>
                <div className={styles.options}>
                  {product.sizes.map((size) => (
                    <button
                      key={size}
                      type="button"
                      className={[styles.option, selectedSize === size ? styles.optionActive : ""].filter(Boolean).join(" ")}
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
              <fieldset className={styles.optionGroup}>
                <legend className={styles.optionLabel}>Colour</legend>
                <div className={styles.options}>
                  {product.colors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={[styles.option, selectedColor === color ? styles.optionActive : ""].filter(Boolean).join(" ")}
                      aria-pressed={selectedColor === color}
                      onClick={() => setSelectedColor(color)}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </fieldset>
            ) : null}

            <div className={styles.optionGroup}>
              <span className={styles.optionLabel}>Quantity</span>
              <div className={styles.quantity}>
                <button type="button" className={styles.quantityButton} onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label="Decrease quantity">
                  −
                </button>
                <span className={styles.quantityValue} aria-live="polite">
                  {quantity}
                </span>
                <button type="button" className={styles.quantityButton} onClick={() => setQuantity((value) => Math.min(99, value + 1))} aria-label="Increase quantity">
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
              <Button size="lg" onClick={() => handleAddToCart(true)} busy={addToCart.isPending}>
                Add to cart
              </Button>
              <Button size="lg" variant="secondary" onClick={() => handleAddToCart(false)} busy={addToCart.isPending}>
                Buy now
              </Button>
            </div>

            <div className={styles.secondaryActions}>
              <button type="button" className={styles.ghostAction}>
                <HeartIcon size={18} /> Save
              </button>
              <button type="button" className={styles.ghostAction}>
                <ShareIcon size={18} /> Share
              </button>
            </div>
          </div>

          <Link href={`/store/${product.store.id}`} className={styles.storeCard}>
            <Avatar name={product.store.name} src={product.store.logoUrl} size="lg" />
            <span className={styles.storeText}>
              <span className={styles.storeName}>
                <StoreIcon size={16} /> {product.store.name}
              </span>
              <span className={styles.storeMeta}>
                ★ {product.store.rating > 0 ? product.store.rating.toFixed(1) : "New"} · {formatCountWithThousandsSuffix(product.store.reviewCount)} reviews
              </span>
            </span>
            <span className={styles.storeCta}>View store</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
