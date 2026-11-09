import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { SellerReturnsSection } from "@/components/seller/sellerReturnsSection";
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
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { sellerService } from "@/services/sellers/seller.service";
import type { OrderStatus } from "@/types";
import { spacing } from "@/constants/spacing.constant";
import { isSellerOrderIncludedInFilter } from "@/utils/sellerOrders.util";

const FILTERS: { key: "all" | OrderStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "To ship" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
  { key: "disputed", label: "Disputed" },
];

export function SellerOrdersScreen({ navigation }: MainScreenProps<"SellerOrders">) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [view, setView] = useState<"orders" | "returns">("orders");
  const [filter, setFilter] = useState<"all" | OrderStatus>("all");
  const { data: orders = [], isLoading, isError, error, refetch, isRefetching } = useQuery({ queryKey: sellerQueryKeys.orders, queryFn: sellerService.listMyStoreOrders });
  const refreshControl = usePullToRefresh(refetch);
  const visibleOrders = useMemo(
    () => (filter === "all" ? orders : orders.filter((order) => isSellerOrderIncludedInFilter(order.status, filter))),
    [orders, filter],
  );

  return (
    <Screen>
      <Header title="Orders" />
      <View style={styles.views} accessibilityRole="tablist">
        {([{ key: "orders", label: "Orders" }, { key: "returns", label: "Return requests" }] as const).map((option) => {
          const selected = view === option.key;
          return (
            <Pressable
              key={option.key}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setView(option.key)}
              style={[styles.viewButton, selected && styles.viewButtonSelected]}
            >
              <Text size={13} weight={selected ? 600 : 500} lineHeight={17} color={selected ? colors.text : colors.textMuted}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {view === "orders" ? (
        <>
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
        </>
      ) : (
        <SellerReturnsSection />
      )}
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  views: { flexDirection: "row", paddingHorizontal: spacing[4], paddingTop: spacing[2], borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  viewButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing[3], borderBottomWidth: 2, borderBottomColor: "transparent" },
  viewButtonSelected: { borderBottomColor: colors.primary },
  filtersBar: { flexGrow: 0, flexShrink: 0 },
  filters: { paddingHorizontal: spacing[4], paddingVertical: spacing[3], gap: spacing[2] },
  list: { paddingHorizontal: spacing[3], paddingBottom: spacing[8] },
  separator: { height: 12 },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing[3] },
}));
