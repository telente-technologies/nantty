import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";

import { ConfirmActionSheet } from "@/components/escrow/confirmActionSheet";
import { useConfirmReceiptMutation, useEscrowForOrderQuery } from "@/components/escrow/escrowQueries.hook";
import { ESCROW_STAGE_APPEARANCE, formatFriendlyDate } from "@/components/escrow/escrowStage.util";
import { StatusPill } from "@/components/escrow/statusPill";
import { CaretRight24Icon, Shield24Icon } from "@/components/icons";
import { CartItemSummary } from "@/components/order/cartItemSummary";
import { DELIVERY_STATUS_APPEARANCE } from "@/components/order/deliveryStatus.util";
import { RatePurchaseCard } from "@/components/reviews/ratePurchaseCard";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { ordersService } from "@/services/commerce/orders.service";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { ErrorState } from "@/components/ui/errorState";
import { describeActionFailure } from "@/errors/errorExperience/describeError";

export function OrderDetailScreen({ navigation, route }: MainScreenProps<"OrderDetail">) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { orderId } = route.params;
  const [confirmSheetVisible, setConfirmSheetVisible] = useState(false);
  const order = useQuery({ queryKey: ["orders", "detail", orderId], queryFn: () => ordersService.fetchOrderById(orderId) });
  const escrow = useEscrowForOrderQuery(orderId);
  const confirmReceipt = useConfirmReceiptMutation(orderId);

  if (!order.data) {
    return (
      <Screen>
        <Header title="Order" />
        {order.isError ? (
          <ErrorState error={order.error} message="Couldn't load this order." onRetry={() => order.refetch()} />
        ) : (
          <ListSkeleton />
        )}
      </Screen>
    );
  }

  const detail = order.data;
  const stage = escrow.data?.stage;
  const canConfirm = detail.status === "shipped" || detail.status === "delivered";
  const isDirect = detail.paymentMode === "direct";
  const canDispute = !isDirect && (detail.status === "paid" || canConfirm) && !escrow.data?.disputeId;
  const releaseLine = isDirect
    ? `Paid directly: ${detail.store.name} was paid right away. For a refund, contact the seller or support.${detail.escrowReleaseAt && detail.status === "delivered" ? ` The order completes automatically ${formatFriendlyDate(detail.escrowReleaseAt)} unless you ask for a return or refund.` : ""}`
    : escrow.data?.releasedAt
    ? `Released to ${detail.store.name} on ${formatFriendlyDate(escrow.data.releasedAt)}`
    : escrow.data?.autoReleaseAt
      ? `Auto-releases ${formatFriendlyDate(escrow.data.autoReleaseAt)} unless you report a problem`
      : "Released only after you confirm the order arrived as described";

  return (
    <Screen>
      <Header title={`Order ${detail.reference}`} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={order.isRefetching} onRefresh={() => Promise.all([order.refetch(), escrow.refetch()])} tintColor={colors.primary} colors={[colors.primary]} />}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View payment protection status"
          onPress={() => navigation.navigate("EscrowStatus", { orderId })}
          style={styles.escrowCard}
        >
          <Shield24Icon color={colors.primary} />
          <View style={styles.flex}>
            <View style={styles.row}>
              <Text size={14} weight={600} lineHeight={16.8}>{isDirect ? "Paid directly" : "Payment protection"}</Text>
              {stage && !isDirect ? <StatusPill label={ESCROW_STAGE_APPEARANCE[stage].label} tone={ESCROW_STAGE_APPEARANCE[stage].tone} /> : null}
            </View>
            <Text size={12} lineHeight={16.8} color={colors.textMuted}>{releaseLine}</Text>
          </View>
          <CaretRight24Icon />
        </Pressable>

        {detail.delivery ? (
          <View style={styles.card}>
            <View style={styles.row}>
              <Text size={14} weight={600} lineHeight={16.8}>Delivery</Text>
              <StatusPill label={DELIVERY_STATUS_APPEARANCE[detail.delivery.status].label} tone={DELIVERY_STATUS_APPEARANCE[detail.delivery.status].tone} />
            </View>
            {detail.shipment?.courierName ? (
              <View style={styles.row}>
                <Text size={12} lineHeight={16.8} color={colors.textMuted}>Courier</Text>
                <Text size={12} lineHeight={16.8} style={styles.deliveryValue}>{detail.shipment.courierName}</Text>
              </View>
            ) : null}
            {detail.shipment?.trackingNumber ? (
              <View style={styles.row}>
                <Text size={12} lineHeight={16.8} color={colors.textMuted}>Tracking</Text>
                <Text size={12} lineHeight={16.8} style={styles.deliveryValue}>{detail.shipment.trackingNumber}</Text>
              </View>
            ) : null}
            {detail.delivery.riderName || detail.delivery.riderPhone ? (
              <View style={styles.row}>
                <Text size={12} lineHeight={16.8} color={colors.textMuted}>Rider</Text>
                <Text size={12} lineHeight={16.8} style={styles.deliveryValue}>{[detail.delivery.riderName, detail.delivery.riderPhone].filter(Boolean).join(" · ")}</Text>
              </View>
            ) : null}
            {detail.delivery.estimatedDeliveryAt ? (
              <View style={styles.row}>
                <Text size={12} lineHeight={16.8} color={colors.textMuted}>Estimated delivery</Text>
                <Text size={12} lineHeight={16.8} style={styles.deliveryValue}>{formatFriendlyDate(detail.delivery.estimatedDeliveryAt)}</Text>
              </View>
            ) : null}
            {detail.delivery.attempts > 0 ? (
              <View style={styles.row}>
                <Text size={12} lineHeight={16.8} color={colors.textMuted}>Delivery attempts</Text>
                <Text size={12} lineHeight={16.8} style={styles.deliveryValue}>{detail.delivery.attempts}</Text>
              </View>
            ) : null}
            {detail.delivery.lastAttemptNote ? <Text size={12} lineHeight={16.8} color={colors.textMuted}>Last attempt: {detail.delivery.lastAttemptNote}</Text> : null}
            {detail.delivery.status === "failed" ? <Text size={12} lineHeight={16.8} color={colors.textMuted}>The seller will try again. Contact them if your address or phone number has changed.</Text> : null}
          </View>
        ) : null}

        <View style={styles.card}>
          <Pressable accessibilityRole="button" onPress={() => navigation.navigate("Store", { storeId: detail.store.id })} style={styles.row}>
            <Text size={14} weight={600} lineHeight={16.8}>{detail.store.name}</Text>
            <Text size={12} lineHeight={16.8} color={colors.primary}>Visit store</Text>
          </Pressable>
          {detail.items.map((item) => (
            <CartItemSummary key={item.id} item={item} onPress={() => navigation.navigate("ProductDetail", { productId: item.product.id })} />
          ))}
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text size={14} weight={600} lineHeight={16.8}>Total paid</Text>
            <Text size={14} weight={600} lineHeight={16.8}>{formatMoneyForDisplay(detail.total)}</Text>
          </View>
          <Text size={12} lineHeight={16.8} color={colors.textSubtle}>Placed {formatFriendlyDate(detail.createdAt)} · includes delivery</Text>
        </View>
        <RatePurchaseCard
          order={detail}
          onRate={(product) => navigation.navigate("WriteReview", { productId: product.id, productName: product.name, imageUrl: product.imageUrl })}
        />
      </ScrollView>
      <View style={styles.footer}>
        {detail.status === "pending" ? <Button title="Check payment" onPress={() => navigation.navigate("Payment", { orderId })} /> : null}
        {canConfirm ? <Button title="Confirm receipt" onPress={() => setConfirmSheetVisible(true)} /> : null}
        {escrow.data?.disputeId ? (
          <Button variant="subtle" title="View dispute" onPress={() => navigation.navigate("DisputeDetail", { disputeId: escrow.data!.disputeId! })} />
        ) : null}
        <View style={styles.footerRow}>
          <Button variant="subtle" title="Contact seller" style={styles.flex} onPress={() => navigation.navigate("Chat", { storeId: detail.store.id, name: detail.store.name })} />
          {canDispute ? <Button variant="subtle" title="Open a dispute" style={styles.flex} onPress={() => navigation.navigate("OpenDispute", { orderId })} /> : null}
        </View>
        <Button variant="subtle" title="Get help with this order" onPress={() => navigation.navigate("NewSupportTicket", { category: "order", linkedReference: { kind: "order", id: orderId, label: `Order ${detail.reference}` } })} />
      </View>
      <ConfirmActionSheet
        intent="naira"
        visible={confirmSheetVisible}
        title="Confirm you received it?"
        message={isDirect ? "Only confirm if everything arrived as described." : `Only confirm if everything arrived as described. ${detail.store.name} will be paid right away and this can't be undone.`}
        confirmTitle="Yes, release payment"
        confirming={confirmReceipt.isPending}
        errorMessage={confirmReceipt.isError ? describeActionFailure(confirmReceipt.error) : null}
        onConfirm={() => confirmReceipt.mutate(undefined, { onSuccess: () => { setConfirmSheetVisible(false); order.refetch(); } })}
        onClose={() => setConfirmSheetVisible(false)}
      />
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 16 },
  escrowCard: { backgroundColor: colors.surface, borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", gap: 12 },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, gap: 12 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  deliveryValue: { flexShrink: 1, textAlign: "right" },
  divider: { height: 1, backgroundColor: colors.background },
  footer: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 12 },
  footerRow: { flexDirection: "row", gap: 12 },
}));
