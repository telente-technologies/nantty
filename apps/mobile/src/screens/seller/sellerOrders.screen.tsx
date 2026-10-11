import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { FlatList, ScrollView, StyleSheet, View } from "react-native";

import { sellerQueryKeys } from "@/components/seller/sellerQueries.hook";
import { StoreOrderRow } from "@/components/seller/storeOrderRow";
import { Truck24Icon } from "@/components/icons";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/emptyState";
import { ErrorState } from "@/components/ui/errorState";
import { Header } from "@/components/ui/header";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { usePullToRefresh } from "@/components/ui/pullToRefresh.hook";
import { Screen } from "@/components/ui/screen";
import { makeThemedStyles, useTheme } from "@/theme";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { sellerService } from "@/services/sellers/seller.service";
import type { OrderStatus } from "@/types";
import { spacing } from "@/constants/spacing.constant";

const FILTERS: { key: "all" | OrderStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
  { key: "disputed", label: "Disputed" },
];

export function SellerOrdersScreen({ navigation }: MainScreenProps<"SellerOrders">) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [filter, setFilter] = useState<"all" | OrderStatus>("all");
  const { data: orders = [], isLoading, isError, error, refetch, isRefetching } = useQuery({ queryKey: sellerQueryKeys.orders, queryFn: sellerService.listMyStoreOrders });
  const refreshControl = usePullToRefresh(refetch);
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
        refreshControl={refreshControl}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <StoreOrderRow order={item} onPress={() => navigation.navigate("SellerOrderDetail", { orderId: item.id })} />
          </View>
        )}
        ListEmptyComponent={
          isLoading ? (
            <ListSkeleton rows={5} avatarSize={48} padding={4} />
          ) : isError ? (
            <ErrorState error={error} compact message="Couldn't load orders." onRetry={() => refetch()} retrying={isRefetching} />
          ) : (
            <EmptyState
              compact
              icon={<Truck24Icon color={colors.textMuted} />}
              title={filter === "all" ? "No orders yet" : `No ${FILTERS.find((f) => f.key === filter)?.label.toLowerCase()} orders`}
              body={filter === "all" ? "New orders from buyers will land here." : undefined}
              actionLabel={filter === "all" ? undefined : "Show all orders"}
              onAction={() => setFilter("all")}
            />
          )
        }
      />
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  filtersBar: { flexGrow: 0, flexShrink: 0 },
  filters: { paddingHorizontal: spacing[4], paddingVertical: spacing[3], gap: spacing[2] },
  list: { paddingHorizontal: spacing[3], paddingBottom: spacing[8] },
  separator: { height: 12 },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing[3] },
}));
