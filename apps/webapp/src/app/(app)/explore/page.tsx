"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { ProductGridSkeleton } from "@/components/commerce/productCardSkeleton";
import { ExploreHome } from "@/components/explore/exploreHome";
import { useRecentSearches } from "@/components/search/recentSearches.hook";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { searchService } from "@/services/search.service";
import type { SearchResultType } from "@/types/search.type";
import { buildExploreSearchHref, defaultSearchResultType, globalSearchContext, resolveSearchContext, searchResultTypesForScope } from "@/utils/searchScope.util";

import styles from "./page.module.css";
import { RecentSearchList } from "./recentSearchList";
import { SearchResultSections } from "./searchResultSections";

function ExploreResults() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get("q")?.trim() ?? "";
  const context = resolveSearchContext(searchParams.get("scope") ?? undefined, searchParams.get("scopeLabel") ?? undefined);
  const tabs = searchResultTypesForScope(context.scope);
  const requestedType = searchParams.get("type") as SearchResultType | null;
  const type = requestedType && tabs.some((tab) => tab.type === requestedType) ? requestedType : defaultSearchResultType(context.scope);
  const recents = useRecentSearches(context.scope);
  const { recordSearch } = recents;

  const resultsQuery = useInfiniteQuery({
    queryKey: ["search", context.scope, type, query],
    queryFn: ({ pageParam }) => searchService.searchWithinScope(query, context.scope, type, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
    enabled: query.length > 0,
    retry: false,
  });

  const searchFor = (nextQuery: string) => router.push(buildExploreSearchHref(nextQuery, context));

  if (!query) {
    return (
      <>
        <RecentSearchList entries={recents.entries} onSelect={searchFor} onRemove={recents.removeSearch} onClear={recents.clearSearches} />
        {context.scope === "global" ? <ExploreHome /> : null}
      </>
    );
  }

  if (resultsQuery.isLoading) return <ProductGridSkeleton gridClassName={styles.productGrid} />;
  if (resultsQuery.isError) return <ErrorState description="Search is unavailable right now." error={resultsQuery.error} onRetry={() => void resultsQuery.refetch()} />;

  const items = resultsQuery.data?.pages.flatMap((page) => page.data) ?? [];
  const scopeSuffix = context.scope === "global" ? "" : ` in ${context.label}`;

  return (
    <div className={styles.results}>
      {tabs.length > 0 ? (
        <div className={styles.scopeRow} role="tablist" aria-label="Search filters">
          {tabs.map((option) => (
            <button
              key={option.type}
              type="button"
              role="tab"
              aria-selected={type === option.type}
              className={[styles.scopeChip, type === option.type ? styles.scopeChipActive : ""].filter(Boolean).join(" ")}
              onClick={() => router.replace(buildExploreSearchHref(query, context, option.type))}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          kind="search"
          title={`No results for “${query}”${scopeSuffix}`}
          description="Try a different spelling or search everywhere."
          action={context.scope === "global" ? undefined : <Button variant="secondary" onClick={() => router.push(buildExploreSearchHref(query, globalSearchContext))}>Search everywhere</Button>}
        />
      ) : (
        <SearchResultSections items={items} surface={query.trim().startsWith("#") ? "hashtag" : "search"} onOpenResult={() => recordSearch(query)} onSearchHashtag={(tag) => searchFor(`#${tag}`)} />
      )}

      {resultsQuery.hasNextPage ? (
        <Button variant="secondary" className={styles.loadMore} busy={resultsQuery.isFetchingNextPage} onClick={() => void resultsQuery.fetchNextPage()}>
          Show more
        </Button>
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
