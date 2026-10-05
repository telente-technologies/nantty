"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { CloseIcon, SearchIcon } from "@/components/ui/icons";
import { useRecentSearches } from "@/components/search/recentSearches.hook";
import { useSearchScopeStore } from "@/store/searchScope.store";
import type { SearchContext } from "@/types/search.type";
import { buildExploreSearchHref, globalSearchContext, resolveSearchContext, searchPlaceholder, searchScopeChipLabel } from "@/utils/searchScope.util";

import styles from "./scopedSearchBar.module.css";

function useActiveSearchContext(): SearchContext {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pageContext = useSearchScopeStore((state) => state.pageContext);
  if (pathname === "/explore") return resolveSearchContext(searchParams.get("scope") ?? undefined, searchParams.get("scopeLabel") ?? undefined);
  return pageContext ?? globalSearchContext;
}

export function ScopedSearchBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeContext = useActiveSearchContext();
  const [widenedFrom, setWidenedFrom] = useState<string | null>(null);
  const [value, setValue] = useState(searchParams.get("q") ?? "");
  const context = widenedFrom === activeContext.scope ? globalSearchContext : activeContext;
  const chipLabel = searchScopeChipLabel(context);
  const { recordSearch } = useRecentSearches(context.scope);

  useEffect(() => {
    setValue(searchParams.get("q") ?? "");
  }, [searchParams]);

  function widenToGlobal() {
    setWidenedFrom(activeContext.scope);
    const query = value.trim();
    if (pathname === "/explore" && query) router.push(buildExploreSearchHref(query, globalSearchContext));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    recordSearch(value);
    router.push(buildExploreSearchHref(value.trim(), context));
  }

  return (
    <form className={styles.field} role="search" onSubmit={handleSubmit}>
      <SearchIcon size={18} className={styles.icon} />
      {chipLabel ? (
        <button type="button" className={styles.chip} onClick={widenToGlobal} aria-label={`${chipLabel}. Remove to search everywhere`}>
          <span className={styles.chipLabel}>{chipLabel}</span>
          <CloseIcon size={14} />
        </button>
      ) : null}
      <input
        type="search"
        className={styles.input}
        placeholder={searchPlaceholder(context)}
        aria-label={searchPlaceholder(context)}
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      {value ? (
        <button type="button" className={styles.clear} onClick={() => setValue("")} aria-label="Clear search">
          <CloseIcon size={16} />
        </button>
      ) : null}
    </form>
  );
}
