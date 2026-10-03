import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { ActivityIndicator, FlatList, StyleSheet } from "react-native";

import { ProductMasonry } from "@/components/home/productMasonry";
import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { productsService } from "@/services/products.service";
import { trackProductInteraction } from "@/services/productInteractions.service";
import { ListSkeleton } from "@/components/ui/listSkeleton";

export function CategoryScreen({ route }: MainScreenProps<"Category">) {
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
  return (
    <Screen background={colors.surface}>
      <Header title={name} />
      <FlatList
        data={[0]}
        keyExtractor={() => "grid"}
        renderItem={() =>
          products.isLoading ? (
            <ListSkeleton />
          ) : allProducts.length === 0 ? (
            <Text align="center" color={colors.textSubtle} style={styles.state}>No products here yet.</Text>
          ) : (
            <ProductMasonry products={allProducts} />
          )
        }
        onEndReached={() => products.hasNextPage && !products.isFetchingNextPage && products.fetchNextPage()}
        onEndReachedThreshold={0.5}
        ListFooterComponent={products.isFetchingNextPage ? <ActivityIndicator style={styles.footer} color={colors.primary} /> : null}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({ state: { marginTop: 64 }, footer: { paddingVertical: 16 } });
