import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from "react-native";

import { OrderListItem } from "@/components/order/orderListItem";
import { Chip } from "@/components/ui/chip";
import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { ordersService } from "@/services/orders.service";
import type { OrderStatus } from "@/types";
import { formatTimeSincePosted } from "@/utils/formatDate.util";

const FILTERS: { label: string; status: OrderStatus | null }[] = [
  { label: "All", status: null },
  { label: "Pending", status: "pending" },
  { label: "Shipped", status: "shipped" },
  { label: "Delivered", status: "delivered" },
];

export function OrdersScreen({ navigation }: MainScreenProps<"Orders">) {
  const [status, setStatus] = useState<OrderStatus | null>(null);
  const orders = useQuery({ queryKey: ["orders", status], queryFn: () => ordersService.fetchMyOrders(status) });
  return (
    <Screen>
      <Header title="My orders" paddingHorizontal={12} />
      <View style={styles.filters}>
        {FILTERS.map((filter) => (
          <Chip key={filter.label} kind="filter" label={filter.label} selected={status === filter.status} onPress={() => setStatus(filter.status)} />
        ))}
      </View>
      <FlatList
        data={orders.data ?? []}
        keyExtractor={(order) => order.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={orders.isRefetching} onRefresh={() => orders.refetch()} tintColor={colors.primary} />}
        renderItem={({ item }) => (
          <OrderListItem
            order={item}
            subtitle={`${item.store.name} • ${formatTimeSincePosted(item.createdAt)} ago`}
            onPress={() => navigation.navigate("OrderDetail", { orderId: item.id })}
          />
        )}
        ListEmptyComponent={
          orders.isLoading ? (
            <ActivityIndicator style={styles.state} color={colors.primary} />
          ) : (
            <Text align="center" color={colors.textSubtle} style={styles.state}>
              {orders.isError ? "Couldn't load your orders." : "No orders here yet."}
            </Text>
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", gap: 8 },
  list: { paddingHorizontal: 12, paddingBottom: 24 },
  state: { marginTop: 64 },
});
