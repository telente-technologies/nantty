import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { ActivityIndicator, FlatList, StyleSheet } from "react-native";

import { ProductMasonry } from "@/components/home/productMasonry";
import { ShoppingCart24Icon } from "@/components/icons";
import { EmptyState } from "@/components/ui/emptyState";
import { ErrorState } from "@/components/ui/errorState";
import { GridSkeleton } from "@/components/ui/gridSkeleton";
import { Header } from "@/components/ui/header";
import { usePullToRefresh } from "@/components/ui/pullToRefresh.hook";
import { Screen } from "@/components/ui/screen";
import { useTheme } from "@/theme";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { productsService } from "@/services/sellers/products.service";
import { trackProductInteraction } from "@/services/sellers/productInteractions.service";
import { spacing } from "@/constants/spacing.constant";

export function CategoryScreen({ navigation, route }: MainScreenProps<"Category">) {
  const { colors } = useTheme();
  const { categoryId, name, collection } = route.params;
  useEffect(() => {
    void trackProductInteraction("category.viewed", { categoryId: collection ?? categoryId });
  }, [categoryId, collection]);
  const products = useInfiniteQuery({
    queryKey: ["products", "page", collection ?? categoryId],
    queryFn: ({ pageParam }) =>
      collection ? productsService.fetchProductCollectionPage(collection, pageParam) : productsService.fetchProductsPage(categoryId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
  const allProducts = (products.data?.pages ?? []).flatMap((page) => page.data);
  const refreshControl = usePullToRefresh(products.refetch);
  return (
    <Screen background={colors.surface}>
      <Header title={name} />
      <FlatList
        data={[0]}
        keyExtractor={() => "grid"}
        renderItem={() =>
          products.isLoading ? (
            <GridSkeleton />
          ) : products.isError && allProducts.length === 0 ? (
            <ErrorState compact message="Couldn't load products." onRetry={() => products.refetch()} retrying={products.isRefetching} />
          ) : allProducts.length === 0 ? (
            <EmptyState
              compact
              icon={<ShoppingCart24Icon color={colors.textMuted} />}
              title="Nothing here yet"
              body="Sellers haven't listed products in this category. Try searching the mart instead."
              actionLabel="Search the mart"
              onAction={() => navigation.navigate("Search", { scope: "mart" })}
            />
          ) : (
            <ProductMasonry products={allProducts} />
          )
        }
        onEndReached={() => products.hasNextPage && !products.isFetchingNextPage && products.fetchNextPage()}
        onEndReachedThreshold={0.5}
        refreshControl={refreshControl}
        contentContainerStyle={styles.content}
        ListFooterComponent={products.isFetchingNextPage ? <ActivityIndicator style={styles.footer} color={colors.primary} /> : null}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({ content: { flexGrow: 1 }, footer: { paddingVertical: spacing[4] } });
