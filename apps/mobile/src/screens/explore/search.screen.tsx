import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { ProductMasonry } from "@/components/home/productMasonry";
import { PersonRow } from "@/components/search/personRow";
import { SearchBar } from "@/components/search/searchBar";
import { BrandRow } from "@/components/store/brandRow";
import { Chip } from "@/components/ui/chip";
import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { trackProductInteraction } from "@/services/productInteractions.service";
import { searchService, type SearchScope } from "@/services/search.service";
import { ListSkeleton } from "@/components/ui/listSkeleton";

const SCOPES: { label: string; scope: SearchScope }[] = [
  { label: "All", scope: "all" },
  { label: "Products", scope: "products" },
  { label: "Stores", scope: "stores" },
  { label: "Brands", scope: "brands" },
  { label: "People", scope: "people" },
];

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
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<SearchScope>(route.params?.scope === "mart" ? "products" : "all");
  const debouncedQuery = useDebouncedText(query.trim(), 300);
  const results = useQuery({
    queryKey: ["search", debouncedQuery, scope],
    queryFn: () => searchService.searchProductsStoresAndPeople(debouncedQuery, scope),
    enabled: debouncedQuery.length > 0,
  });
  useEffect(() => {
    if (debouncedQuery.length > 0) void trackProductInteraction("search.performed", { query: debouncedQuery, scope });
  }, [debouncedQuery, scope]);
  const data = results.data;

  return (
    <Screen background={colors.surface}>
      <Header />
      <View style={styles.searchRow}>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search for anything..." />
      </View>
      <View style={styles.scopes}>
        {SCOPES.map((option) => (
          <Chip key={option.scope} kind="filter" label={option.label} selected={scope === option.scope} onPress={() => setScope(option.scope)} />
        ))}
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {debouncedQuery.length === 0 ? (
          <Text align="center" color={colors.textSubtle} style={styles.state}>Search products, stores and people.</Text>
        ) : results.isLoading ? (
          <ListSkeleton />
        ) : !data || (data.products.length + data.stores.length + data.people.length + (data.brands?.length ?? 0) === 0) ? (
          <Text align="center" color={colors.textSubtle} style={styles.state}>No results for “{debouncedQuery}”.</Text>
        ) : (
          <>
            {data.stores.length > 0 && (scope === "all" || scope === "stores") ? (
              <View style={styles.section}>
                <Text size={13} weight={500} lineHeight={16.9} color={colors.textMuted}>Stores</Text>
                {data.stores.map((store) => (
                  <PersonRow key={store.id} name={store.name} handle={`${store.rating.toFixed(1)} rating · ${store.reviewCount} reviews`} avatarUrl={store.logoUrl} onPress={() => navigation.navigate("Store", { storeId: store.id })} />
                ))}
              </View>
            ) : null}
            {(data.brands?.length ?? 0) > 0 && (scope === "all" || scope === "brands") ? (
              <View style={styles.section}>
                <Text size={13} weight={500} lineHeight={16.9} color={colors.textMuted}>Brands</Text>
                {data.brands!.map((brand) => (
                  <BrandRow key={brand.id} brand={brand} onPress={() => navigation.navigate("BrandProfile", { brandId: brand.id })} />
                ))}
              </View>
            ) : null}
            {data.people.length > 0 && (scope === "all" || scope === "people") ? (
              <View style={styles.section}>
                <Text size={13} weight={500} lineHeight={16.9} color={colors.textMuted}>People</Text>
                {data.people.map((person) => (
                  <PersonRow key={person.id} name={person.name} handle={`@${person.username}`} avatarUrl={person.avatarUrl} verified={person.verified} onPress={() => navigation.navigate("UserProfile", { userId: person.id })} />
                ))}
              </View>
            ) : null}
            {data.products.length > 0 && (scope === "all" || scope === "products") ? (
              <View>
                <Text size={13} weight={500} lineHeight={16.9} color={colors.textMuted} style={styles.productsTitle}>Products</Text>
                <ProductMasonry products={data.products} adPlacement="search" />
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchRow: { paddingHorizontal: 16, flexDirection: "row" },
  scopes: { paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  content: { paddingBottom: 24, gap: 20 },
  section: { paddingHorizontal: 16, gap: 4 },
  productsTitle: { marginBottom: 8, paddingHorizontal: 16 },
  state: { marginTop: 64, paddingHorizontal: 32 },
});
