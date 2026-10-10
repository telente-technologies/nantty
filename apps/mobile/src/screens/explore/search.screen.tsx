import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { ExploreHome } from "@/components/explore/exploreHome";
import { RecentSearchList } from "@/components/search/recentSearchList";
import { useRecentSearches } from "@/components/search/recentSearches.hook";
import { SearchBar } from "@/components/search/searchBar";
import { SearchResultSections, type SearchResultHandlers } from "@/components/search/searchResultSections";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { ErrorState } from "@/components/ui/errorState";
import { Header } from "@/components/ui/header";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { useAuthStore } from "@/store/auth.store";
import { trackProductInteraction } from "@/services/sellers/productInteractions.service";
import { searchService } from "@/services/feed/search.service";
import type { SearchContext, SearchResultType } from "@/types/search.type";
import { defaultSearchResultType, globalSearchContext, resolveSearchContext, searchPlaceholder, searchResultTypesForScope, searchScopeChipLabel } from "@/utils/searchScope.util";
import { spacing } from "@/constants/spacing.constant";

function useDebouncedText(text: string, delayMs: number) {
  const [debounced, setDebounced] = useState(text);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(text), delayMs);
    return () => clearTimeout(timer);
  }, [text, delayMs]);
  return debounced;
}

export function SearchScreen({ navigation, route }: MainScreenProps<"Search">) {
  const { colors } = useTheme();
  const [context, setContext] = useState<SearchContext>(() => resolveSearchContext(route.params?.scope, route.params?.scopeLabel));
  const [type, setType] = useState<SearchResultType>(() => defaultSearchResultType(context.scope));
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedText(query.trim(), 300);
  const recents = useRecentSearches(context.scope);
  const results = useInfiniteQuery({
    queryKey: ["search", context.scope, type, debouncedQuery],
    queryFn: ({ pageParam }) => searchService.searchWithinScope(debouncedQuery, context.scope, type, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
    enabled: debouncedQuery.length > 0,
  });
  useEffect(() => {
    if (debouncedQuery.length > 0) void trackProductInteraction("search.performed", { query: debouncedQuery, scope: context.scope, type });
  }, [debouncedQuery, context.scope, type]);

  const items = results.data?.pages.flatMap((page) => page.data) ?? [];
  const ownStoreId = useAuthStore((state) => state.user?.storeId ?? null);
  const tabs = searchResultTypesForScope(context.scope, ownStoreId);
  const chipLabel = searchScopeChipLabel(context);
  const widenToGlobal = () => {
    setContext(globalSearchContext);
    setType("top");
  };
  const remember = () => recents.recordSearch(query);
  const rememberThen = (open: () => void) => {
    remember();
    open();
  };
  const handlers: SearchResultHandlers = {
    onOpenUser: (userId) => rememberThen(() => navigation.navigate("UserProfile", { userId })),
    onOpenStore: (storeId) => rememberThen(() => navigation.navigate("Store", { storeId })),
    onOpenBrand: (brandId) => rememberThen(() => navigation.navigate("BrandProfile", { brandId })),
    onOpenPost: (item) => rememberThen(() => (item.type === "clip" ? navigation.navigate("Tabs", { screen: "Clips", params: { startId: item.id } }) : navigation.navigate("PostDetail", { postId: item.id }))),
    onOpenCategory: (categoryId, name) => rememberThen(() => navigation.navigate("Category", { categoryId, name })),
    onSearchHashtag: (tag) => setQuery(`#${tag}`),
    onOpenOrder: (orderId) => rememberThen(() => navigation.navigate("SellerOrderDetail", { orderId })),
  };

  return (
    <Screen background={colors.surface}>
      <Header />
      <View style={styles.searchRow}>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={remember}
          placeholder={searchPlaceholder(context)}
          scopeChip={chipLabel ? { label: chipLabel, onClear: widenToGlobal } : null}
        />
      </View>
      {query.trim().length > 0 && tabs.length > 0 ? (
        <View style={styles.scopes}>
          {tabs.map((option) => (
            <Chip key={option.type} kind="filter" label={option.label} selected={type === option.type} onPress={() => setType(option.type)} />
          ))}
        </View>
      ) : null}
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {debouncedQuery.length === 0 ? (
          <>
            <RecentSearchList entries={recents.entries} onSelect={setQuery} onRemove={recents.removeSearch} onClear={recents.clearSearches} />
            {context.scope === "global" ? (
              <ExploreHome
                onSearchHashtag={(hashtag) => setQuery(`#${hashtag}`)}
                onOpenPost={(postId) => navigation.navigate("PostDetail", { postId })}
                onOpenProfile={(userId) => navigation.navigate("UserProfile", { userId })}
              />
            ) : recents.entries.length === 0 ? (
              <Text align="center" color={colors.textSubtle} style={styles.state}>{searchPlaceholder(context)}</Text>
            ) : null}
          </>
        ) : results.isError ? (
          <ErrorState message="Search is unavailable right now." onRetry={() => void results.refetch()} />
        ) : results.isLoading ? (
          <ListSkeleton />
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <Text align="center" color={colors.textSubtle}>No results for “{debouncedQuery}”{chipLabel ? ` in ${context.label}` : ""}.</Text>
            {chipLabel ? <Button title="Search everywhere" variant="outline" onPress={widenToGlobal} /> : null}
          </View>
        ) : (
          <>
            <SearchResultSections items={items} handlers={handlers} />
            {results.hasNextPage ? (
              <View style={styles.more}>
                <Button title="Show more" variant="outline" loading={results.isFetchingNextPage} onPress={() => void results.fetchNextPage()} />
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchRow: { paddingHorizontal: spacing[4], flexDirection: "row" },
  scopes: { paddingHorizontal: spacing[4], paddingVertical: spacing[3], flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },
  content: { paddingBottom: spacing[6], gap: spacing[5] },
  state: { marginTop: 64, paddingHorizontal: spacing[7] },
  empty: { marginTop: 64, paddingHorizontal: spacing[7], gap: spacing[4] },
  more: { paddingHorizontal: spacing[4] },
});
