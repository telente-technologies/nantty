import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { CaretDown24Icon, MagnifyingGlass24Icon } from "@/components/icons";
import { BusinessDocumentsNudge } from "@/components/seller/businessDocumentsNudge";
import { InventoryCard } from "@/components/seller/inventoryCard";
import { PayoutSetupCard } from "@/components/payoutOnboarding/payoutSetupCard";
import { PeriodChips } from "@/components/seller/periodChips";
import { SalesChart } from "@/components/seller/salesChart";
import { SellerWebAppNote } from "@/components/seller/sellerWebAppNote";
import { Button } from "@/components/ui/button";
import { splitMoneyIntoSymbolAndAmount } from "@/components/seller/splitMoney.util";
import { useSellerDashboardQuery } from "@/components/seller/sellerQueries.hook";
import { StoreOrderRow } from "@/components/seller/storeOrderRow";
import { Header, HeaderAction } from "@/components/ui/header";
import { useAuthStore } from "@/store/auth.store";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { MainScreenProps } from "@/navigation/navigation.types";
import type { SellerDashboardPeriod } from "@/types/account.type";
import { ErrorState } from "@/components/ui/errorState";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { usePullToRefresh } from "@/components/ui/pullToRefresh.hook";
import { spacing } from "@/constants/spacing.constant";
import { typeScale } from "@/constants/typography.constant";


export function SellerDashboardScreen({ navigation }: MainScreenProps<"SellerDashboard">) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [period, setPeriod] = useState<SellerDashboardPeriod>("today");
  const [ordersExpanded, setOrdersExpanded] = useState(true);
  const [inventoryExpanded, setInventoryExpanded] = useState(true);
  const { data: dashboard, isLoading, isError, refetch, isRefetching } = useSellerDashboardQuery(period);
  const refreshControl = usePullToRefresh(refetch);
  const myStoreId = useAuthStore((state) => state.user?.storeId ?? null);
  const totalSales = dashboard ? splitMoneyIntoSymbolAndAmount(dashboard.totalSales) : null;

  return (
    <Screen>
      <Header
        title="Dashboard"
        right={
          myStoreId ? (
            <HeaderAction label="Search your products and orders" onPress={() => navigation.navigate("Search", { scope: `store:${myStoreId}`, scopeLabel: "your store" })}>
              <MagnifyingGlass24Icon />
            </HeaderAction>
          ) : null
        }
      />
      <BusinessDocumentsNudge />
      <PeriodChips value={period} onChange={setPeriod} />
      {isError && !dashboard ? (
        <ErrorState message="Couldn't load your dashboard." onRetry={() => refetch()} retrying={isRefetching} />
      ) : isLoading || !dashboard || !totalSales ? (
        <ListSkeleton />
      ) : (
        <ScrollView contentContainerStyle={styles.content} refreshControl={refreshControl}>
          <View style={styles.total} accessibilityLabel={`Total sales ${totalSales.symbol}${totalSales.amount}, ${dashboard.orders} orders`}>
            <Text size={typeScale.md} weight={500} lineHeight={16.8} color={colors.textMuted}>
              Total sales
            </Text>
            <View style={styles.amount}>
              <Text size={18} weight={600} lineHeight={21.6}>{totalSales.symbol}</Text>
              <Text size={28} weight={600} lineHeight={33.6}>
                {totalSales.amount}
              </Text>
            </View>
            <Text size={typeScale.md} weight={500} lineHeight={16.8}>
              {dashboard.orders} {dashboard.orders === 1 ? "order" : "orders"}
            </Text>
          </View>

          <PayoutSetupCard context="seller" />

          <View style={styles.quickLinks}>
            <Button variant="subtle" title="Orders" height={38} style={styles.quickLink} onPress={() => navigation.navigate("SellerOrders")} />
            <Button variant="subtle" title="Products" height={38} style={styles.quickLink} onPress={() => navigation.navigate("SellerProducts")} />
            <Button variant="subtle" title="Wallet" height={38} style={styles.quickLink} onPress={() => navigation.navigate("Wallet")} />
          </View>

          <SalesChart values={dashboard.series.map((point) => point.value)} />

          <View style={styles.ordersCard}>
            <SectionTitle title="Recent orders" expanded={ordersExpanded} onToggle={() => setOrdersExpanded((v) => !v)} />
            {ordersExpanded ? (
              <View style={styles.orders}>
                {dashboard.recentOrders.map((order) => (
                  <StoreOrderRow key={order.id} order={order} onPress={() => navigation.navigate("SellerOrderDetail", { orderId: order.id })} />
                ))}
                <Text size={typeScale.sm} weight={500} lineHeight={16.9} color={colors.primary} accessibilityRole="link" onPress={() => navigation.navigate("SellerOrders")}>
                  See all orders
                </Text>
              </View>
            ) : null}
          </View>

          <SectionTitle title="Inventory" expanded={inventoryExpanded} onToggle={() => setInventoryExpanded((v) => !v)} />
          {inventoryExpanded ? (
            <View style={styles.inventory}>
              {dashboard.inventory.map((product) => (
                <InventoryCard key={product.id} product={product} onPress={() => navigation.navigate("ProductForm", { productId: product.id })} />
              ))}
            </View>
          ) : null}
          <SellerWebAppNote />
        </ScrollView>
      )}
    </Screen>
  );
}

function SectionTitle({ title, expanded, onToggle }: { title: string; expanded: boolean; onToggle: () => void }) {
  const styles = useStyles();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={onToggle} style={styles.sectionTitle}>
      <Text size={typeScale.base} weight={500} lineHeight={19.2}>
        {title}
      </Text>
      <View style={!expanded && styles.collapsed}>
        <CaretDown24Icon />
      </View>
    </Pressable>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  content: { paddingHorizontal: spacing[3], paddingBottom: spacing[8], gap: spacing[4] },
  total: { alignItems: "center", gap: spacing[2], marginTop: spacing[3], marginBottom: spacing[2] },
  amount: { flexDirection: "row", alignItems: "center" },
  ordersCard: { borderWidth: 2, borderColor: colors.skeleton, borderRadius: 24, padding: spacing[3], gap: spacing[6] },
  orders: { gap: spacing[3] },
  sectionTitle: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  collapsed: { transform: [{ rotate: "-90deg" }] },
  quickLinks: { flexDirection: "row", gap: spacing[2] },
  quickLink: { flex: 1 },
  inventory: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: spacing[4] },
}));
