import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { RefreshControl, ScrollView, SectionList, StyleSheet, View } from "react-native";

import { OrderListItem } from "@/components/order/orderListItem";
import { RatePurchaseLink } from "@/components/reviews/ratePurchaseCard";
import { Chip } from "@/components/ui/chip";
import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { ordersService } from "@/services/orders.service";
import type { Order, OrderStatus } from "@/types";
import { formatTimeSincePosted } from "@/utils/formatDate.util";
import { ErrorState } from "@/components/ui/errorState";
import { ListSkeleton } from "@/components/ui/listSkeleton";

type OrderFilterKey = "all" | "to_ship" | "on_the_way" | "to_confirm" | "completed" | "disputed" | "cancelled";

const ORDER_GROUPS: readonly { readonly title: string; readonly statuses: readonly OrderStatus[]; readonly filter: OrderFilterKey }[] = [
  { title: "Delivered — please confirm", statuses: ["delivered"], filter: "to_confirm" },
  { title: "On the way", statuses: ["shipped"], filter: "on_the_way" },
  { title: "Seller preparing", statuses: ["paid"], filter: "to_ship" },
  { title: "Awaiting payment", statuses: ["pending"], filter: "to_ship" },
  { title: "In dispute", statuses: ["disputed"], filter: "disputed" },
  { title: "Completed", statuses: ["completed"], filter: "completed" },
  { title: "Cancelled & refunded", statuses: ["cancelled"], filter: "cancelled" },
];

const FILTERS: readonly { readonly key: OrderFilterKey; readonly label: string }[] = [
  { key: "all", label: "All" },
  { key: "to_ship", label: "To ship" },
  { key: "on_the_way", label: "On the way" },
  { key: "to_confirm", label: "To confirm" },
  { key: "completed", label: "Completed" },
  { key: "disputed", label: "Disputes" },
  { key: "cancelled", label: "Cancelled" },
];

const describeOrderForList = (order: Order) =>
  `${order.store.name} · ${order.reference} · ${formatTimeSincePosted(order.createdAt)} ago`;

export function OrdersScreen({ navigation }: MainScreenProps<"Orders">) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [filter, setFilter] = useState<OrderFilterKey>("all");
  const orders = useQuery({ queryKey: ["orders", "all"], queryFn: () => ordersService.fetchMyOrders(null) });

  const sections = useMemo(
    () =>
      ORDER_GROUPS.filter((group) => filter === "all" || group.filter === filter)
        .map((group) => ({ title: group.title, data: (orders.data ?? []).filter((order) => group.statuses.includes(order.status)) }))
        .filter((section) => section.data.length > 0),
    [orders.data, filter],
  );

  return (
    <Screen>
      <Header title="My orders" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersBar} contentContainerStyle={styles.filters}>
        {FILTERS.map((option) => (
          <Chip key={option.key} kind="filter" label={option.label} selected={filter === option.key} onPress={() => setFilter(option.key)} />
        ))}
      </ScrollView>
      <SectionList
        sections={sections}
        keyExtractor={(order) => order.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={orders.isRefetching} onRefresh={() => orders.refetch()} tintColor={colors.primary} />}
        renderSectionHeader={({ section }) => (
          <Text size={13} weight={600} lineHeight={16.9} color={colors.textMuted} style={styles.sectionTitle} accessibilityRole="header">
            {section.title} · {section.data.length}
          </Text>
        )}
        renderItem={({ item, index, section }) => (
          <View style={[styles.row, index === 0 && styles.firstRow, index === section.data.length - 1 && styles.lastRow]}>
            <OrderListItem order={item} subtitle={describeOrderForList(item)} onPress={() => navigation.navigate("OrderDetail", { orderId: item.id })} />
            <RatePurchaseLink
              order={item}
              onRate={(product) => navigation.navigate("WriteReview", { productId: product.id, productName: product.name, imageUrl: product.imageUrl })}
            />
          </View>
        )}
        ListEmptyComponent={
          orders.isLoading ? (
            <ListSkeleton />
          ) : orders.isError ? (
            <ErrorState message="Couldn't load your orders." onRetry={() => orders.refetch()} />
          ) : (
            <Text align="center" color={colors.textSubtle} style={styles.state}>No orders here yet.</Text>
          )
        }
      />
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  filtersBar: { flexGrow: 0, flexShrink: 0 },
  filters: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  sectionTitle: { marginTop: 16, marginBottom: 8 },
  row: { backgroundColor: colors.surface, paddingHorizontal: 12 },
  firstRow: { borderTopLeftRadius: 12, borderTopRightRadius: 12, paddingTop: 4 },
  lastRow: { borderBottomLeftRadius: 12, borderBottomRightRadius: 12, paddingBottom: 4 },
  state: { marginTop: 64 },
}));
