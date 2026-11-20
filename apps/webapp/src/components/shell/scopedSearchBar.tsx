"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { CloseIcon, SearchIcon } from "@/components/ui/icons";
import { useRecentSearches } from "@/components/search/recentSearches.hook";
import { searchService } from "@/services/search.service";
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
  const [debounced, setDebounced] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const context = widenedFrom === activeContext.scope ? globalSearchContext : activeContext;
  const chipLabel = searchScopeChipLabel(context);
  const { recordSearch } = useRecentSearches(context.scope);

  useEffect(() => {
    setValue(searchParams.get("q") ?? "");
  }, [searchParams]);

  useEffect(() => {
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setDebounced("");
      return;
    }
    const timer = setTimeout(() => setDebounced(trimmed), 200);
    return () => clearTimeout(timer);
  }, [value]);

  const suggestionsQuery = useQuery({
    queryKey: ["search", "suggest", debounced],
    queryFn: () => searchService.suggestSearch(debounced),
    enabled: isFocused && debounced.length >= 2,
    staleTime: 30_000,
    retry: false,
  });
  const suggestions = (suggestionsQuery.data ?? []).filter((item) => item.text.trim() !== "");

  function widenToGlobal() {
    setWidenedFrom(activeContext.scope);
    const query = value.trim();
    if (pathname === "/explore" && query) router.push(buildExploreSearchHref(query, globalSearchContext));
  }

  function submitSearchTerm(term: string) {
    const trimmed = term.trim();
    if (!trimmed) return;
    recordSearch(trimmed);
    setValue(trimmed);
    setIsFocused(false);
    router.push(buildExploreSearchHref(trimmed, context));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    recordSearch(value);
    setIsFocused(false);
    router.push(buildExploreSearchHref(value.trim(), context));
  }

  return (
    <div className={styles.wrap}>
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
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 150)}
          onChange={(event) => setValue(event.target.value)}
        />
        {value ? (
          <button type="button" className={styles.clear} onClick={() => setValue("")} aria-label="Clear search">
            <CloseIcon size={16} />
          </button>
        ) : null}
      </form>
      {isFocused && suggestions.length > 0 ? (
        <ul className={styles.suggestions} role="listbox" aria-label="Search suggestions">
          {suggestions.map((suggestion) => (
            <li key={`${suggestion.type}:${suggestion.id}`} role="option" aria-selected={false}>
              <button
                type="button"
                className={styles.suggestionItem}
                onMouseDown={(event) => {
                  event.preventDefault();
                  submitSearchTerm(suggestion.text);
                }}
              >
                <SearchIcon size={14} className={styles.icon} />
                <span className={styles.suggestionText}>{suggestion.text}</span>
                <span className={styles.suggestionType}>{suggestion.type}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
