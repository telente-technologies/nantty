import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";

import { escrowQueryKeys, useEscrowForOrderQuery } from "@/components/escrow/escrowQueries.hook";
import { EscrowSummaryCard } from "@/components/escrow/escrowSummaryCard";
import { EscrowTimeline } from "@/components/escrow/escrowTimeline";
import { formatFriendlyDate } from "@/components/escrow/escrowStage.util";
import { MarkAsShippedSheet } from "@/components/seller/markAsShippedSheet";
import { sellerQueryKeys } from "@/components/seller/sellerQueries.hook";
import { SettingsGroup, SettingsRow } from "@/components/settings/settingsGroup";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { generateIdempotencyKey } from "@/services/core/apiClient.service";
import { sellerService } from "@/services/sellers/seller.service";
import type { MarkOrderShippedInput } from "@/types/commerce.type";
import { formatMoneyForDisplay, multiplyMoneyByQuantity } from "@/utils/formatMoney.util";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { describeActionFailure } from "@/errors/errorExperience/describeError";

export function SellerOrderDetailScreen({ navigation, route }: MainScreenProps<"SellerOrderDetail">) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { orderId } = route.params;
  const queryClient = useQueryClient();
  const [shipSheetVisible, setShipSheetVisible] = useState(false);
  const idempotencyKeyForShipment = useRef(generateIdempotencyKey());
  const orderQuery = useQuery({ queryKey: sellerQueryKeys.order(orderId), queryFn: () => sellerService.fetchStoreOrderById(orderId) });
  const escrowQuery = useEscrowForOrderQuery(orderId);

  const markAsShipped = useMutation({
    mutationFn: (input: MarkOrderShippedInput) => sellerService.markStoreOrderAsShipped(orderId, input, idempotencyKeyForShipment.current),
    onSuccess: (updated) => {
      setShipSheetVisible(false);
      queryClient.setQueryData(sellerQueryKeys.order(orderId), updated);
      queryClient.invalidateQueries({ queryKey: ["seller"] });
      queryClient.invalidateQueries({ queryKey: escrowQueryKeys.forOrder(orderId) });
    },
  });

  const order = orderQuery.data;
  const escrow = escrowQuery.data;
  if (!order || !escrow) {
    return (
      <Screen>
        <Header title="Order" />
        <ListSkeleton />
      </Screen>
    );
  }

  const needsShipping = order.status === "paid";
  const fundsHeld = ["paid", "shipped", "delivered", "disputed"].includes(order.status);
  const muted = { color: colors.textMuted, weight: 400 as const };

  return (
    <Screen>
      <Header title={`Order ${order.reference}`} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={escrowQuery.isRefetching} onRefresh={() => Promise.all([orderQuery.refetch(), escrowQuery.refetch()])} tintColor={colors.primary} colors={[colors.primary]} />}
      >
        <EscrowSummaryCard escrow={escrow} viewerRole="seller" />
        {fundsHeld ? (
          <View style={styles.heldNotice}>
            <Text size={13} weight={500} lineHeight={16.9} color={colors.cautionStrongText}>Funds held in escrow until the buyer confirms</Text>
            <Text size={12} lineHeight={16.8} color={colors.textMuted}>
              {order.status === "disputed"
                ? "The buyer opened a dispute, so the release is paused. Respond quickly to resolve it."
                : escrow.expectedReleaseAt
                  ? `Expected release to your wallet: ${formatFriendlyDate(escrow.expectedReleaseAt)} (or sooner if the buyer confirms).`
                  : "Ship the order to start the release countdown."}
            </Text>
          </View>
        ) : null}
        {needsShipping ? <Button title="Mark as shipped" onPress={() => setShipSheetVisible(true)} /> : null}
        {escrow.disputeId ? <Button variant="subtle" title="View dispute" onPress={() => navigation.navigate("DisputeDetail", { disputeId: escrow.disputeId! })} /> : null}
        <View style={styles.card}>
          <Text size={16} weight={600} lineHeight={19.2} accessibilityRole="header">Progress</Text>
          <EscrowTimeline escrow={escrow} viewerRole="seller" />
        </View>
        <SettingsGroup>
          {order.items.map((item) => (
            <SettingsRow
              key={item.id}
              label={`${item.quantity} × ${item.product.name}${item.variant ? ` (${item.variant})` : ""}`}
              trailing={{ text: formatMoneyForDisplay(multiplyMoneyByQuantity(item.product.price, item.quantity)), color: colors.text }}
            />
          ))}
          <SettingsRow label="Order total" trailing={{ text: formatMoneyForDisplay(order.total), color: colors.text }} />
        </SettingsGroup>
        <SettingsGroup>
          <SettingsRow label="Buyer" trailing={{ text: order.buyer.name, ...muted }} onPress={() => navigation.navigate("UserProfile", { userId: order.buyer.id })} />
          <SettingsRow label="Placed" trailing={{ text: formatFriendlyDate(order.createdAt), ...muted }} />
          <SettingsRow label="Message buyer" onPress={() => navigation.navigate("Chat", { userId: order.buyer.id, name: order.buyer.name })} />
        </SettingsGroup>
      </ScrollView>
      <MarkAsShippedSheet
        visible={shipSheetVisible}
        submitting={markAsShipped.isPending}
        errorMessage={markAsShipped.isError ? describeActionFailure(markAsShipped.error) : null}
        onClose={() => setShipSheetVisible(false)}
        onSubmit={(input) => markAsShipped.mutate(input)}
      />
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40, gap: 16 },
  heldNotice: { backgroundColor: colors.cautionTint, borderRadius: 12, padding: 12, gap: 4 },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, gap: 16 },
}));
