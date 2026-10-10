import { useQuery } from "@tanstack/react-query";
import { FlatList, StyleSheet } from "react-native";

import { InventoryCard } from "@/components/seller/inventoryCard";
import { sellerQueryKeys } from "@/components/seller/sellerQueries.hook";
import { Tag24Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/emptyState";
import { ErrorState } from "@/components/ui/errorState";
import { GridSkeleton } from "@/components/ui/gridSkeleton";
import { Header } from "@/components/ui/header";
import { usePullToRefresh } from "@/components/ui/pullToRefresh.hook";
import { Screen } from "@/components/ui/screen";
import { useTheme } from "@/theme";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { sellerService } from "@/services/sellers/seller.service";
import { spacing } from "@/constants/spacing.constant";

export function SellerProductsScreen({ navigation }: MainScreenProps<"SellerProducts">) {
  const { colors } = useTheme();
  const { data: products = [], isLoading, isError, refetch, isRefetching } = useQuery({ queryKey: sellerQueryKeys.products, queryFn: sellerService.listMyStoreProducts });
  const refreshControl = usePullToRefresh(refetch);
  return (
    <Screen>
      <Header title="Products" />
      <FlatList
        data={products}
        keyExtractor={(product) => product.id}
        numColumns={2}
        refreshControl={refreshControl}
        columnWrapperStyle={styles.column}
        contentContainerStyle={styles.list}
        ListHeaderComponent={<Button title="Add product" onPress={() => navigation.navigate("ProductForm")} style={styles.add} />}
        renderItem={({ item }) => <InventoryCard product={item} onPress={() => navigation.navigate("ProductForm", { productId: item.id })} />}
        ListEmptyComponent={
          isLoading ? (
            <GridSkeleton items={4} />
          ) : isError ? (
            <ErrorState compact message="Couldn't load your products." onRetry={() => refetch()} retrying={isRefetching} />
          ) : (
            <EmptyState compact icon={<Tag24Icon color={colors.textMuted} />} title="No products yet" body="Add your first product so buyers can find your store." />
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing[3], paddingBottom: spacing[8], gap: spacing[4] },
  column: { justifyContent: "space-between" },
  add: { marginTop: spacing[4], marginBottom: spacing[2] },
});
