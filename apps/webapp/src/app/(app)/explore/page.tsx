"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { ProductCard } from "@/components/commerce/productCard";
import { ProductGridSkeleton } from "@/components/commerce/productCardSkeleton";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { RetryButton } from "@/components/ui/controls";
import { Avatar } from "@/components/ui/media";
import { searchService, type SearchScope } from "@/services/search.service";
import { useQuery } from "@tanstack/react-query";

import styles from "./page.module.css";
import { AppIcon, IconLabel } from "@/components/ui/appIcon";

const scopeOptions: readonly { readonly value: SearchScope; readonly label: string }[] = [
  { value: "all", label: "All" },
  { value: "products", label: "Products" },
  { value: "stores", label: "Stores" },
  { value: "brands", label: "Brands" },
  { value: "people", label: "People" },
];

function ExploreResults() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q")?.trim() ?? "";
  const [scope, setScope] = useState<SearchScope>(scopeOptions[0]!.value);

  const resultsQuery = useQuery({
    queryKey: ["search", query, scope],
    queryFn: () => searchService.searchProductsStoresAndPeople(query, scope),
    enabled: query.length > 0,
    retry: false,
  });

  if (!query) {
    return (
      <EmptyState
        icon={<AppIcon name="magnifyingGlass24" size={28} />}
        title="Search Zudomart"
        description="Find products, stores, brands and people. Use the search bar above to get started."
      />
    );
  }

  if (resultsQuery.isLoading) return <ProductGridSkeleton gridClassName={styles.productGrid} />;
  if (resultsQuery.isError) return <ErrorState description="Search is unavailable right now." action={<RetryButton onRetry={() => resultsQuery.refetch()} />} />;

  const results = resultsQuery.data;
  const totalResults = (results?.products.length ?? 0) + (results?.stores.length ?? 0) + (results?.people.length ?? 0) + (results?.brands?.length ?? 0);

  if (totalResults === 0) {
    return <EmptyState icon={<AppIcon name="searchOff24" size={28} />} title={`No results for “${query}”`} description="Try a different spelling or browse categories from the home screen." />;
  }

  return (
    <div className={styles.results}>
      <div className={styles.scopeRow} role="tablist" aria-label="Search filters">
        {scopeOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={scope === option.value}
            className={[styles.scopeChip, scope === option.value ? styles.scopeChipActive : ""].filter(Boolean).join(" ")}
            onClick={() => setScope(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {results?.products.length ? (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Products</h2>
          <div className={styles.productGrid}>
            {results.products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      ) : null}

      {results?.stores.length ? (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Stores</h2>
          <ul className={styles.entityList}>
            {results.stores.map((store) => (
              <li key={store.id}>
                <Link href={`/store/${store.id}`} className={styles.entityRow}>
                  <Avatar name={store.name} src={store.logoUrl} size="md" />
                  <span className={styles.entityText}>
                    <span className={styles.entityName}>{store.name}</span>
                    <span className={styles.entityMeta}><IconLabel name="star16" size={12}>{store.rating > 0 ? store.rating.toFixed(1) : "New"} · {store.reviewCount} reviews</IconLabel></span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {results?.brands?.length ? (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Brands</h2>
          <ul className={styles.entityList}>
            {results.brands.map((brand) => (
              <li key={brand.id}>
                <Link href={`/store/${brand.id}`} className={styles.entityRow}>
                  <Avatar name={brand.name} src={brand.logoUrl} size="md" />
                  <span className={styles.entityText}>
                    <span className={styles.entityName}>{brand.name}</span>
                    <span className={styles.entityMeta}>@{brand.handle}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {results?.people.length ? (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>People</h2>
          <ul className={styles.entityList}>
            {results.people.map((person) => (
              <li key={person.id}>
                <Link href={`/${person.username}`} className={styles.entityRow}>
                  <Avatar name={person.name} src={person.avatarUrl} size="md" />
                  <span className={styles.entityText}>
                    <span className={styles.entityName}>{person.name}</span>
                    <span className={styles.entityMeta}>@{person.username}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}


export default function ExplorePage() {
  return (
    <div className={styles.page}>
      <Suspense>
        <ExploreResults />
      </Suspense>
    </div>
  );
}
