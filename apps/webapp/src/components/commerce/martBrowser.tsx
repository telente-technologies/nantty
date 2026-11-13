"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { ProductCard } from "@/components/commerce/productCard";
import { useProductInteraction } from "@/components/commerce/useProductInteraction.hook";
import { ProductGridSkeleton } from "@/components/commerce/productCardSkeleton";
import { useSession } from "@/components/providers/sessionProvider";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/feedback";
import { MediaImage } from "@/components/ui/media";
import { useInfiniteScrollSentinel } from "@/components/ui/useInfiniteScrollSentinel.hook";
import { productsService } from "@/services/products.service";
import { prioritizeMartRecommendations } from "@/utils/martRecommendations.util";

import styles from "./martBrowser.module.css";
import { MartCategoryBar } from "./martCategoryBar";
import { MartHighlightsCarousel } from "./martHighlightsCarousel";
import { AppIcon } from "@/components/ui/appIcon";

const featuredCollections = [
  { href: "/collections/sales_of_the_day", label: "Sales of the Day", caption: "Fresh deals every morning", imageKey: "salesOfTheDayImageUrl", className: "collectionTileSales" },
  { href: "/collections/featured_brands", label: "Featured Brands", caption: "Official and verified stores", imageKey: "featuredBrandsImageUrl", className: "collectionTileBrands" },
  { href: "/collections/new_arrivals", label: "New Arrivals", caption: "Just listed by sellers", imageKey: "newArrivalsImageUrl", className: "collectionTileArrivals" },
] as const;

const HIGHLIGHTS_STALE_MS = 5 * 60_000;

export function MartBrowser() {
  const viewerId = useSession().viewer?.id ?? "guest";
  const { track: trackInteraction } = useProductInteraction();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const martHome = useQuery({ queryKey: ["mart", "home"], queryFn: productsService.fetchMartHome, retry: false });
  const highlights = useQuery({
    queryKey: ["mart", "highlights"],
    queryFn: () => productsService.fetchMartHighlights(),
    staleTime: HIGHLIGHTS_STALE_MS,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    retry: false,
  });
  const productsQuery = useInfiniteQuery({
    queryKey: ["products", "page", selectedCategoryId],
    queryFn: ({ pageParam }) => productsService.fetchProductsPage(selectedCategoryId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
  const recommendations = useQuery({
    // Scope personalized results to the viewer so account switches never reuse another user's rank order.
    queryKey: ["mart", "recommendations", "mart_home", viewerId],
    queryFn: () => productsService.fetchProductsYouMightLike("mart_home"),
    enabled: selectedCategoryId === null,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const sentinelRef = useInfiniteScrollSentinel({
    hasNextPage: productsQuery.hasNextPage,
    isFetchingNextPage: productsQuery.isFetchingNextPage,
    fetchNextPage: productsQuery.fetchNextPage,
  });
  const catalogProducts = (productsQuery.data?.pages ?? []).flatMap((page) => page.data);
  const products = selectedCategoryId || !recommendations.data?.products.length
    ? catalogProducts
    : prioritizeMartRecommendations(catalogProducts, recommendations.data.products);

  return (
    <div className={styles.mart}>
      <header className={styles.header}>
        <h1 className={styles.title}>Mart</h1>
        <p className={styles.subtitle}>Every order is held in escrow until it arrives.</p>
      </header>

      <MartHighlightsCarousel highlights={highlights.data?.data ?? []} loading={highlights.isLoading} />

      <div className={styles.collectionRow}>
        {featuredCollections.map((collection) => (
          <Link
            key={collection.href}
            href={collection.href}
            className={[styles.collectionTile, styles[collection.className], martHome.data?.[collection.imageKey] ? "" : styles.collectionTileFallback].filter(Boolean).join(" ")}
          >
            <MediaImage
              src={martHome.data?.[collection.imageKey]}
              alt=""
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 40vw, 620px"
              className={styles.collectionImage}
            />
            <span className={styles.collectionLabel}>{collection.label}</span>
            <span className={styles.collectionCaption}>{collection.caption}</span>
          </Link>
        ))}
      </div>

      <MartCategoryBar categories={martHome.data?.categories ?? []} selectedCategoryId={selectedCategoryId} onSelectCategory={setSelectedCategoryId} />

      {productsQuery.isLoading ? (
        <ProductGridSkeleton gridClassName={styles.productGrid} />
      ) : productsQuery.isError ? (
        <ErrorState description="We couldn't load products." error={productsQuery.error} onRetry={() => void productsQuery.refetch()} />
      ) : products.length === 0 ? (
        <EmptyState icon={<AppIcon name="shoppingBag24" size={28} />} title="Nothing here yet" description="No products in this category right now. Try another category." />
      ) : (
        <div className={styles.productGrid}>
          {products.map((product, index) => (
            <ProductCard key={product.id} product={product} showStoreDetails onClick={() => trackInteraction("product.clicked", { productId: product.id, surface: "mart_home", position: index })} />
          ))}
        </div>
      )}

      <div ref={sentinelRef} />
      {productsQuery.isFetchingNextPage ? <Spinner label="Loading more products" /> : null}
    </div>
  );
}
