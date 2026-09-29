import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";

import { CartItemSummary } from "@/components/order/cartItemSummary";
import { OrderStatusBadge } from "@/components/order/orderStatusBadge";
import { OrderTimeline } from "@/components/order/orderTimeline";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { colors, palette } from "@/constants/colors.constant";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { generateIdempotencyKey } from "@/services/apiClient.service";
import { ordersService } from "@/services/orders.service";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

export function OrderDetailScreen({ navigation, route }: MainScreenProps<"OrderDetail">) {
  const { orderId } = route.params;
  const queryClient = useQueryClient();
  const confirmKey = useRef(generateIdempotencyKey());
  const order = useQuery({ queryKey: ["orders", "detail", orderId], queryFn: () => ordersService.fetchOrderById(orderId) });

  const confirmReceipt = useMutation({
    mutationFn: () => ordersService.confirmOrderReceipt(orderId, confirmKey.current),
    onSuccess: (updated) => {
      queryClient.setQueryData(["orders", "detail", orderId], updated);
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  if (!order.data) {
    return (
      <Screen>
        <Header title="Order" paddingHorizontal={12} />
        {order.isError ? (
          <Text align="center" color={colors.textSubtle} style={styles.state}>Couldn't load this order.</Text>
        ) : (
          <ActivityIndicator style={styles.state} color={colors.primary} />
        )}
      </Screen>
    );
  }

  const detail = order.data;
  const canConfirm = detail.status === "shipped" || detail.status === "delivered";
  const canDispute = detail.status === "paid" || detail.status === "shipped" || detail.status === "delivered";
  return (
    <Screen>
      <Header title={`Order ${detail.reference}`} paddingHorizontal={12} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.row}>
          <Text size={14} weight={500} lineHeight={16.8}>{detail.store.name}</Text>
          <OrderStatusBadge status={detail.status} />
        </View>
        <OrderTimeline status={detail.status} />
        <View style={styles.escrow}>
          <Text size={13} weight={500} lineHeight={16.9} color={palette.primary[700]}>
            {detail.status === "completed" ? "Payment released to the seller" : "Payment held in escrow"}
          </Text>
          <Text size={12} lineHeight={16.8} color={colors.textMuted}>
            {detail.status === "completed"
              ? "Thanks for confirming. The seller has been paid."
              : detail.escrowReleaseAt
                ? `If you don't confirm or open a dispute, payment is released on ${new Date(detail.escrowReleaseAt).toDateString()}.`
                : "The seller is paid only after you confirm the order arrived as described."}
          </Text>
        </View>
        <View style={styles.items}>
          {detail.items.map((item) => (
            <CartItemSummary key={item.id} item={item} onPress={() => navigation.navigate("ProductDetail", { productId: item.product.id })} />
          ))}
        </View>
        <View style={styles.row}>
          <Text size={14} weight={600} lineHeight={16.8}>Total</Text>
          <Text size={14} weight={600} lineHeight={16.8}>{formatMoneyForDisplay(detail.total)}</Text>
        </View>
      </ScrollView>
      <View style={styles.footer}>
        {confirmReceipt.isError ? (
          <Text size={12} lineHeight={14.4} color={colors.error} align="center" accessibilityRole="alert">
            Couldn't confirm receipt. Try again.
          </Text>
        ) : null}
        {canConfirm ? <Button title="Confirm receipt" loading={confirmReceipt.isPending} onPress={() => confirmReceipt.mutate()} /> : null}
        {canDispute ? <Button variant="danger" title="Report a problem" onPress={() => navigation.navigate("OpenDispute", { orderId })} /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  state: { marginTop: 64 },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 24 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  escrow: { padding: 12, borderRadius: 8, backgroundColor: palette.primary[50], gap: 4 },
  items: { gap: 8 },
  footer: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
});
