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
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { MainScreenProps } from "@/navigation/navigation.types";
import type { SellerDashboardPeriod } from "@/types/account.type";
import { ListSkeleton } from "@/components/ui/listSkeleton";


export function SellerDashboardScreen({ navigation }: MainScreenProps<"SellerDashboard">) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [period, setPeriod] = useState<SellerDashboardPeriod>("today");
  const [ordersExpanded, setOrdersExpanded] = useState(true);
  const [inventoryExpanded, setInventoryExpanded] = useState(true);
  const { data: dashboard, isLoading } = useSellerDashboardQuery(period);
  const totalSales = dashboard ? splitMoneyIntoSymbolAndAmount(dashboard.totalSales) : null;

  return (
    <Screen>
      <Header
        title="Dashboard"
        right={
          <HeaderAction label="Search your orders and products" onPress={() => navigation.navigate("SellerProducts")}>
            <MagnifyingGlass24Icon />
          </HeaderAction>
        }
      />
      <BusinessDocumentsNudge />
      <PeriodChips value={period} onChange={setPeriod} />
      {isLoading || !dashboard || !totalSales ? (
        <ListSkeleton />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.total} accessibilityLabel={`Total sales ${totalSales.symbol}${totalSales.amount}, ${dashboard.orders} orders`}>
            <Text size={14} weight={500} lineHeight={16.8} color={colors.textMuted}>
              Total sales
            </Text>
            <View style={styles.amount}>
              <Text size={18} weight={600} lineHeight={21.6}>{totalSales.symbol}</Text>
              <Text size={28} weight={600} lineHeight={33.6}>
                {totalSales.amount}
              </Text>
            </View>
            <Text size={14} weight={500} lineHeight={16.8}>
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
                <Text size={13} weight={500} lineHeight={16.9} color={colors.primary} accessibilityRole="link" onPress={() => navigation.navigate("SellerOrders")}>
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
      <Text size={16} weight={500} lineHeight={19.2}>
        {title}
      </Text>
      <View style={!expanded && styles.collapsed}>
        <CaretDown24Icon />
      </View>
    </Pressable>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  content: { paddingHorizontal: 12, paddingBottom: 40, gap: 16 },
  total: { alignItems: "center", gap: 8, marginTop: 12, marginBottom: 9 },
  amount: { flexDirection: "row", alignItems: "center" },
  ordersCard: { borderWidth: 2, borderColor: colors.skeleton, borderRadius: 24, padding: 12, gap: 24 },
  orders: { gap: 12 },
  sectionTitle: { height: 24, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  collapsed: { transform: [{ rotate: "-90deg" }] },
  quickLinks: { flexDirection: "row", gap: 8 },
  quickLink: { flex: 1 },
  inventory: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 16 },
}));
