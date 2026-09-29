import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View, type NativeScrollEvent } from "react-native";

import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import { productsService } from "@/services/products.service";

import { CategoryTabs } from "./categoryTabs";
import { MartShowcase } from "./martShowcase";
import { ProductMasonry } from "./productMasonry";
import { SellOnZudomartBanner } from "./sellOnZudomartBanner";

const COLLECTION_FOR_TILE = {
  sales: { collection: "sales_of_the_day", name: "Sales of the Day" },
  brands: { collection: "featured_brands", name: "Featured Brands" },
  arrivals: { collection: "new_arrivals", name: "New Arrivals" },
} as const;

const isNearBottom = ({ layoutMeasurement, contentOffset, contentSize }: NativeScrollEvent) =>
  layoutMeasurement.height + contentOffset.y >= contentSize.height - 600;

export function MartTab() {
  const navigation = useNavigation();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const martHome = useQuery({ queryKey: ["mart-home"], queryFn: productsService.fetchMartHome });
  const products = useInfiniteQuery({
    queryKey: ["products", "page", selectedCategoryId],
    queryFn: ({ pageParam }) => productsService.fetchProductsPage(selectedCategoryId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
  const allProducts = (products.data?.pages ?? []).flatMap((page) => page.data);

  return (
    <ScrollView
      style={styles.root}
      scrollEventThrottle={200}
      showsVerticalScrollIndicator={false}
      onScroll={({ nativeEvent }) => {
        if (isNearBottom(nativeEvent) && products.hasNextPage && !products.isFetchingNextPage) products.fetchNextPage();
      }}
      refreshControl={
        <RefreshControl
          refreshing={products.isRefetching}
          onRefresh={() => Promise.all([products.refetch(), martHome.refetch()])}
          tintColor={colors.primary}
        />
      }
    >
      <MartShowcase
        martHome={martHome.data}
        onPressSearch={() => navigation.navigate("Search", { scope: "mart" })}
        onPressTile={(tile) => {
          const target = COLLECTION_FOR_TILE[tile];
          navigation.navigate("Category", { categoryId: target.collection, name: target.name, collection: target.collection });
        }}
      />
      <SellOnZudomartBanner />
      <View style={styles.categories}>
        <CategoryTabs
          categories={martHome.data?.categories ?? []}
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={setSelectedCategoryId}
        />
      </View>
      {products.isLoading ? (
        <ActivityIndicator style={styles.state} color={colors.primary} />
      ) : allProducts.length === 0 ? (
        <Text style={styles.state} align="center" color={colors.textSubtle}>
          {products.isError ? "Couldn't load products. Pull to try again." : "No products in this category yet."}
        </Text>
      ) : (
        <ProductMasonry products={allProducts} />
      )}
      {products.isFetchingNextPage ? <ActivityIndicator style={styles.footer} color={colors.primary} /> : <View style={styles.footer} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  categories: { marginTop: 34, marginBottom: 12 },
  state: { marginTop: 48, paddingHorizontal: 32 },
  footer: { paddingVertical: 16 },
});
