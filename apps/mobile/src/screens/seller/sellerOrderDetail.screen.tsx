import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";

import { OrderStatusPill } from "@/components/seller/orderStatusPill";
import { sellerQueryKeys } from "@/components/seller/sellerQueries.hook";
import { SettingsGroup, SettingsRow } from "@/components/settings/settingsGroup";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { sellerService } from "@/services/seller.service";
import { formatMoneyForDisplay, multiplyMoneyByQuantity } from "@/utils/formatMoney.util";

export function SellerOrderDetailScreen({ route }: MainScreenProps<"SellerOrderDetail">) {
  const { orderId } = route.params;
  const queryClient = useQueryClient();
  const { data: order } = useQuery({ queryKey: sellerQueryKeys.order(orderId), queryFn: () => sellerService.fetchStoreOrderById(orderId) });
  const markAsShipped = useMutation({
    mutationFn: () => sellerService.markStoreOrderAsShipped(orderId),
    onSuccess: (updated) => {
      queryClient.setQueryData(sellerQueryKeys.order(orderId), updated);
      queryClient.invalidateQueries({ queryKey: ["seller"] });
    },
  });

  if (!order) {
    return (
      <Screen>
        <Header title="Order" />
        <ActivityIndicator style={styles.loading} color={colors.primary} />
      </Screen>
    );
  }

  const canShip = order.status === "pending" || order.status === "paid";

  return (
    <Screen>
      <Header title={`Order #${order.reference}`} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.statusRow}>
          <Text size={14} lineHeight={16.8} color={colors.textMuted}>
            Status
          </Text>
          <OrderStatusPill status={order.status} />
        </View>
        <SettingsGroup>
          {order.items.map((item) => (
            <SettingsRow
              key={item.id}
              label={`${item.quantity} × ${item.product.name}${item.variant ? ` (${item.variant})` : ""}`}
              trailing={{ text: formatMoneyForDisplay(multiplyMoneyByQuantity(item.product.price, item.quantity)), color: colors.text }}
            />
          ))}
          <SettingsRow label="Total" trailing={{ text: formatMoneyForDisplay(order.total), color: colors.text }} />
        </SettingsGroup>
        <SettingsGroup>
          <SettingsRow label="Buyer" trailing={{ text: order.buyer.name, color: colors.textMuted, weight: 400 }} />
          <SettingsRow label="Placed" trailing={{ text: new Date(order.createdAt).toLocaleDateString("en-NG"), color: colors.textMuted, weight: 400 }} />
        </SettingsGroup>
        <Text size={12} lineHeight={16.8} color={colors.textSubtle}>
          Payment is held in escrow and released to your wallet after the buyer confirms delivery.
        </Text>
        {canShip ? <Button title="Mark as shipped" loading={markAsShipped.isPending} onPress={() => markAsShipped.mutate()} /> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: 80 },
  content: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 40, gap: 24 },
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});
