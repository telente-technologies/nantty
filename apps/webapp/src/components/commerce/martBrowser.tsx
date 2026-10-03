"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { ProductCard } from "@/components/commerce/productCard";
import { ProductGridSkeleton } from "@/components/commerce/productCardSkeleton";
import { RetryButton } from "@/components/ui/controls";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/feedback";
import chipStyles from "@/components/ui/filterChips.module.css";
import { useInfiniteScrollSentinel } from "@/components/ui/useInfiniteScrollSentinel.hook";
import { productsService } from "@/services/products.service";

import styles from "./martBrowser.module.css";
import { AppIcon } from "@/components/ui/appIcon";

const featuredCollections = [
  { href: "/collections/sales_of_the_day", label: "Sales of the Day", caption: "Fresh deals every morning" },
  { href: "/collections/featured_brands", label: "Featured Brands", caption: "Official and verified stores" },
  { href: "/collections/new_arrivals", label: "New Arrivals", caption: "Just listed by sellers" },
];

export function MartBrowser() {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const martHome = useQuery({ queryKey: ["mart", "home"], queryFn: productsService.fetchMartHome, retry: false });
  const productsQuery = useInfiniteQuery({
    queryKey: ["products", "page", selectedCategoryId],
    queryFn: ({ pageParam }) => productsService.fetchProductsPage(selectedCategoryId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
  const sentinelRef = useInfiniteScrollSentinel({
    hasNextPage: productsQuery.hasNextPage,
    isFetchingNextPage: productsQuery.isFetchingNextPage,
    fetchNextPage: productsQuery.fetchNextPage,
  });
  const products = (productsQuery.data?.pages ?? []).flatMap((page) => page.data);

  return (
    <div className={styles.mart}>
      <header className={styles.header}>
        <h1 className={styles.title}>Mart</h1>
        <p className={styles.subtitle}>Every order is held in escrow until it arrives.</p>
      </header>

      {martHome.data?.banners.length ? (
        <div className={styles.banners}>
          {martHome.data.banners.slice(0, 3).map((banner) => (
            <Link key={banner.id} href="/explore" className={styles.banner}>
              <img src={banner.imageUrl ?? undefined} alt="" className={styles.bannerImage} loading="lazy" />
            </Link>
          ))}
        </div>
      ) : null}

      <div className={styles.collectionRow}>
        {featuredCollections.map((collection) => (
          <Link key={collection.href} href={collection.href} className={styles.collectionTile}>
            <span className={styles.collectionLabel}>{collection.label}</span>
            <span className={styles.collectionCaption}>{collection.caption}</span>
          </Link>
        ))}
      </div>

      <div className={chipStyles.chipRow} role="group" aria-label="Filter products by category">
        <button
          type="button"
          className={[chipStyles.chip, selectedCategoryId === null ? chipStyles.chipActive : ""].join(" ")}
          aria-pressed={selectedCategoryId === null}
          onClick={() => setSelectedCategoryId(null)}
        >
          All
        </button>
        {(martHome.data?.categories ?? []).map((category) => (
          <button
            key={category.id}
            type="button"
            className={[chipStyles.chip, selectedCategoryId === category.id ? chipStyles.chipActive : ""].join(" ")}
            aria-pressed={selectedCategoryId === category.id}
            onClick={() => setSelectedCategoryId((previous) => (previous === category.id ? null : category.id))}
          >
            {category.name}
          </button>
        ))}
      </div>

      {productsQuery.isLoading ? (
        <ProductGridSkeleton gridClassName={styles.productGrid} />
      ) : productsQuery.isError ? (
        <ErrorState description="We couldn't load products." action={<RetryButton onRetry={() => productsQuery.refetch()} />} />
      ) : products.length === 0 ? (
        <EmptyState icon={<AppIcon name="shoppingBag24" size={28} />} title="Nothing here yet" description="No products in this category right now. Try another category." />
      ) : (
        <div className={styles.productGrid}>
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      <div ref={sentinelRef} />
      {productsQuery.isFetchingNextPage ? <Spinner label="Loading more products" /> : null}
    </div>
  );
}
