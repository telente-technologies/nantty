"use client";

import { useEffect, useRef } from "react";

import { ProductCard } from "@/components/commerce/productCard";
import { ProductGridSkeleton } from "@/components/commerce/productCardSkeleton";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/feedback";
import { productsService } from "@/services/products.service";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { ProductCollection } from "@/types/commerce.type";

import styles from "./productCollectionBrowser.module.css";
import { AppIcon } from "@/components/ui/appIcon";

interface ProductCollectionBrowserProps {
  readonly title: string;
  readonly categoryId?: string;
  readonly collection?: ProductCollection;
}

export function ProductCollectionBrowser({ title, categoryId, collection }: ProductCollectionBrowserProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const query = useInfiniteQuery({
    queryKey: ["products", "collection", categoryId ?? null, collection ?? null],
    queryFn: ({ pageParam }) =>
      collection ? productsService.fetchProductCollectionPage(collection, pageParam) : productsService.fetchProductsPage(categoryId ?? null, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  const products = (query.data?.pages ?? []).flatMap((page) => page.data);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !query.hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !query.isFetchingNextPage) query.fetchNextPage();
      },
      { rootMargin: "700px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [query]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.count}>{products.length > 0 ? `${products.length}${query.hasNextPage ? "+" : ""} products` : ""}</p>
      </header>

      {query.isLoading ? (
        <ProductGridSkeleton gridClassName={styles.grid} />
      ) : query.isError ? (
        <ErrorState description="We couldn't load this collection." error={query.error} onRetry={() => void query.refetch()} />
      ) : products.length === 0 ? (
        <EmptyState icon={<AppIcon name="shoppingBag24" size={28} />} title="Nothing here yet" description="Products in this section will appear here soon." />
      ) : (
        <div className={styles.grid}>
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      <div ref={sentinelRef} />
      {query.isFetchingNextPage ? <Spinner label="Loading more products" /> : null}
    </div>
  );
}
