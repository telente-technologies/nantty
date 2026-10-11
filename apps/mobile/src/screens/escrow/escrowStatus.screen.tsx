import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";

import { ConfirmActionSheet } from "@/components/escrow/confirmActionSheet";
import { EscrowExplainerCard } from "@/components/escrow/escrowExplainerCard";
import { useConfirmReceiptMutation, useEscrowForOrderQuery } from "@/components/escrow/escrowQueries.hook";
import { EscrowSummaryCard } from "@/components/escrow/escrowSummaryCard";
import { EscrowTimeline } from "@/components/escrow/escrowTimeline";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { useAuthStore } from "@/store/auth.store";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { ErrorState } from "@/components/ui/errorState";
import { describeActionFailure } from "@/errors/errorExperience/describeError";

const STAGES_BUYER_CAN_CONFIRM = new Set(["shipped", "delivered"]);
const STAGES_BUYER_CAN_DISPUTE = new Set(["seller_preparing", "paid_into_escrow", "shipped", "delivered"]);

export function EscrowStatusScreen({ navigation, route }: MainScreenProps<"EscrowStatus">) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { orderId } = route.params;
  const signedInUserId = useAuthStore((state) => state.user?.id);
  const escrowQuery = useEscrowForOrderQuery(orderId);
  const confirmReceipt = useConfirmReceiptMutation(orderId);
  const [confirmSheetVisible, setConfirmSheetVisible] = useState(false);

  if (!escrowQuery.data) {
    return (
      <Screen>
        <Header title="Payment protection" />
        {escrowQuery.isError ? (
          <ErrorState error={escrowQuery.error} message="Couldn't load the escrow status." onRetry={() => escrowQuery.refetch()} />
        ) : (
          <ListSkeleton />
        )}
      </Screen>
    );
  }

  const escrow = escrowQuery.data;
  const viewerRole = escrow.sellerUserId === signedInUserId ? "seller" : "buyer";
  const buyerCanConfirm = viewerRole === "buyer" && STAGES_BUYER_CAN_CONFIRM.has(escrow.stage);
  const buyerCanDispute = viewerRole === "buyer" && !escrow.disputeId && STAGES_BUYER_CAN_DISPUTE.has(escrow.stage);

  const confirmAndReleasePayment = () =>
    confirmReceipt.mutate(undefined, { onSuccess: () => setConfirmSheetVisible(false) });

  return (
    <Screen>
      <Header title="Payment protection" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={escrowQuery.isRefetching} onRefresh={() => escrowQuery.refetch()} tintColor={colors.primary} colors={[colors.primary]} />}
      >
        <EscrowSummaryCard escrow={escrow} viewerRole={viewerRole} />
        <View style={styles.card}>
          <Text size={16} weight={600} lineHeight={19.2} accessibilityRole="header">
            Progress
          </Text>
          <EscrowTimeline escrow={escrow} viewerRole={viewerRole} />
        </View>
        <EscrowExplainerCard viewerRole={viewerRole} />
        <View style={styles.actions}>
          {buyerCanConfirm ? <Button title="Confirm receipt" onPress={() => setConfirmSheetVisible(true)} /> : null}
          {viewerRole === "seller" && escrow.stage === "seller_preparing" ? (
            <Button title="Mark as shipped" onPress={() => navigation.navigate("SellerOrderDetail", { orderId })} />
          ) : null}
          {escrow.disputeId ? (
            <Button variant="subtle" title="View dispute" onPress={() => navigation.navigate("DisputeDetail", { disputeId: escrow.disputeId! })} />
          ) : null}
          {buyerCanDispute ? <Button variant="subtle" title="Open a dispute" onPress={() => navigation.navigate("OpenDispute", { orderId })} /> : null}
          <Button
            variant="subtle"
            title={viewerRole === "buyer" ? "Contact seller" : "Contact buyer"}
            onPress={() =>
              navigation.navigate(
                "Chat",
                viewerRole === "buyer" ? { userId: escrow.sellerUserId, name: escrow.store.name } : { userId: escrow.buyer.id, name: escrow.buyer.name },
              )
            }
          />
        </View>
      </ScrollView>
      <ConfirmActionSheet
        intent="naira"
        visible={confirmSheetVisible}
        title="Confirm you received it?"
        message={`Only confirm if everything arrived as described. ${escrow.store.name} will be paid right away and this can't be undone.`}
        confirmTitle="Yes, release payment"
        confirming={confirmReceipt.isPending}
        errorMessage={confirmReceipt.isError ? describeActionFailure(confirmReceipt.error) : null}
        onConfirm={confirmAndReleasePayment}
        onClose={() => setConfirmSheetVisible(false)}
      />
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40, gap: 16 },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, gap: 16 },
  actions: { gap: 12 },
}));
