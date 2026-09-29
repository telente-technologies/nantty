import { useInfiniteQuery } from "@tanstack/react-query";
import { ActivityIndicator, FlatList, StyleSheet } from "react-native";

import { ProductMasonry } from "@/components/home/productMasonry";
import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { productsService } from "@/services/products.service";

export function CategoryScreen({ route }: MainScreenProps<"Category">) {
  const { categoryId, name } = route.params;
  const products = useInfiniteQuery({
    queryKey: ["products", "page", categoryId],
    queryFn: ({ pageParam }) => productsService.fetchProductsPage(categoryId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
  const allProducts = (products.data?.pages ?? []).flatMap((page) => page.data);
  return (
    <Screen background={colors.white}>
      <Header title={name} />
      <FlatList
        data={[0]}
        keyExtractor={() => "grid"}
        renderItem={() =>
          products.isLoading ? (
            <ActivityIndicator style={styles.state} color={colors.primary} />
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
