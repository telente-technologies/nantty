import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { FlatList, ScrollView, StyleSheet, View } from "react-native";

import { sellerQueryKeys } from "@/components/seller/sellerQueries.hook";
import { StoreOrderRow } from "@/components/seller/storeOrderRow";
import { Chip } from "@/components/ui/chip";
import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { sellerService } from "@/services/seller.service";
import type { OrderStatus } from "@/types";

const FILTERS: { key: "all" | OrderStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
  { key: "disputed", label: "Disputed" },
];

export function SellerOrdersScreen({ navigation }: MainScreenProps<"SellerOrders">) {
  const [filter, setFilter] = useState<"all" | OrderStatus>("all");
  const { data: orders = [], isLoading, refetch, isRefetching } = useQuery({ queryKey: sellerQueryKeys.orders, queryFn: sellerService.listMyStoreOrders });
  const visibleOrders = useMemo(
    () => (filter === "all" ? orders : orders.filter((o) => o.status === filter || (filter === "pending" && o.status === "paid"))),
    [orders, filter],
  );

  return (
    <Screen>
      <Header title="Orders" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersBar} contentContainerStyle={styles.filters}>
        {FILTERS.map((f) => (
          <Chip key={f.key} kind="filter" label={f.label} selected={f.key === filter} onPress={() => setFilter(f.key)} />
        ))}
      </ScrollView>
      <FlatList
        data={visibleOrders}
        keyExtractor={(order) => order.id}
        refreshing={isRefetching}
        onRefresh={refetch}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <StoreOrderRow order={item} onPress={() => navigation.navigate("SellerOrderDetail", { orderId: item.id })} />
          </View>
        )}
        ListEmptyComponent={
          isLoading ? null : (
            <Text size={14} lineHeight={16.8} color={colors.textSubtle} align="center" style={styles.empty}>
              No orders here yet
            </Text>
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  filtersBar: { flexGrow: 0 },
  filters: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  list: { paddingHorizontal: 12, paddingBottom: 40 },
  separator: { height: 12 },
  card: { backgroundColor: colors.white, borderRadius: 12, padding: 12 },
  empty: { marginTop: 80 },
});
