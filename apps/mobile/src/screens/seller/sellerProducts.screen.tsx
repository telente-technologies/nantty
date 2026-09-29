import { useQuery } from "@tanstack/react-query";
import { FlatList, StyleSheet } from "react-native";

import { InventoryCard } from "@/components/seller/inventoryCard";
import { sellerQueryKeys } from "@/components/seller/sellerQueries.hook";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { sellerService } from "@/services/seller.service";

export function SellerProductsScreen({ navigation }: MainScreenProps<"SellerProducts">) {
  const { data: products = [], isLoading, refetch, isRefetching } = useQuery({ queryKey: sellerQueryKeys.products, queryFn: sellerService.listMyStoreProducts });
  return (
    <Screen>
      <Header title="Products" />
      <FlatList
        data={products}
        keyExtractor={(product) => product.id}
        numColumns={2}
        refreshing={isRefetching}
        onRefresh={refetch}
        columnWrapperStyle={styles.column}
        contentContainerStyle={styles.list}
        ListHeaderComponent={<Button title="Add product" onPress={() => navigation.navigate("ProductForm")} style={styles.add} />}
        renderItem={({ item }) => <InventoryCard product={item} onPress={() => navigation.navigate("ProductForm", { productId: item.id })} />}
        ListEmptyComponent={
          isLoading ? null : (
            <Text size={14} lineHeight={16.8} color={colors.textSubtle} align="center" style={styles.empty}>
              You haven't listed any products yet
            </Text>
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 12, paddingBottom: 40, gap: 16 },
  column: { justifyContent: "space-between" },
  add: { marginTop: 16, marginBottom: 8 },
  empty: { marginTop: 60 },
});
