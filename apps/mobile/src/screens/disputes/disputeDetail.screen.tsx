import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from "react-native";

import { DisputeMessageBubble } from "@/components/escrow/disputeMessageBubble";
import { DisputeStatusHistory } from "@/components/escrow/disputeStatusHistory";
import { escrowQueryKeys, useDisputeQuery } from "@/components/escrow/escrowQueries.hook";
import { DISPUTE_STATUS_APPEARANCE, disputeReasonLabel, formatFriendlyDateTime } from "@/components/escrow/escrowStage.util";
import { StatusPill } from "@/components/escrow/statusPill";
import { PaperPlaneTilt24Icon } from "@/components/icons";
import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { fontFamily } from "@/constants/typography.constant";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { generateIdempotencyKey } from "@/services/apiClient.service";
import { disputesService } from "@/services/disputes.service";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { ErrorState } from "@/components/ui/errorState";

export function DisputeDetailScreen({ navigation, route }: MainScreenProps<"DisputeDetail">) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { disputeId } = route.params;
  const queryClient = useQueryClient();
  const disputeQuery = useDisputeQuery(disputeId);
  const [draftMessage, setDraftMessage] = useState("");

  const sendMessage = useMutation({
    mutationFn: (text: string) => disputesService.sendDisputeMessage(disputeId, text, [], generateIdempotencyKey()),
    onSuccess: () => {
      setDraftMessage("");
      queryClient.invalidateQueries({ queryKey: escrowQueryKeys.dispute(disputeId) });
    },
  });

  if (!disputeQuery.data) {
    return (
      <Screen>
        <Header title="Dispute" />
        {disputeQuery.isError ? (
          <ErrorState message="Couldn't load this dispute." onRetry={() => disputeQuery.refetch()} />
        ) : (
          <ListSkeleton />
        )}
      </Screen>
    );
  }

  const dispute = disputeQuery.data;
  const appearance = DISPUTE_STATUS_APPEARANCE[dispute.status];
  const isResolved = dispute.status.startsWith("resolved") || dispute.status === "closed";
  const sellerMustRespond = dispute.viewerRole === "seller" && dispute.status === "awaiting_seller";

  return (
    <Screen>
      <Header title={`Dispute · ${dispute.orderReference}`} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={disputeQuery.isRefetching} onRefresh={() => disputeQuery.refetch()} tintColor={colors.primary} />}
        >
          <View style={styles.card}>
            <View style={styles.row}>
              <Text size={16} weight={600} lineHeight={19.2} style={styles.flex} numberOfLines={1}>{dispute.productName}</Text>
              <StatusPill label={appearance.label} tone={appearance.tone} />
            </View>
            <Text size={13} lineHeight={16.9} color={colors.textMuted}>
              {disputeReasonLabel(dispute.reason)} · {formatMoneyForDisplay(dispute.amount)} held in escrow
            </Text>
            <Text size={13} lineHeight={16.9} color={colors.textMuted}>
              {dispute.viewerRole === "buyer" ? "Seller" : "Buyer"}: {dispute.counterpartyName} · Opened {formatFriendlyDateTime(dispute.openedAt)}
            </Text>
            {sellerMustRespond && dispute.respondByAt ? (
              <Text size={13} weight={500} lineHeight={16.9} color={colors.error}>
                Respond by {formatFriendlyDateTime(dispute.respondByAt)} or support will decide without your input.
              </Text>
            ) : null}
            <Text size={14} lineHeight={19} style={styles.description}>{dispute.description}</Text>
            {dispute.evidenceUrls.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.evidence}>
                {dispute.evidenceUrls.map((url, index) => (
                  <Image key={url} source={{ uri: url }} style={styles.evidencePhoto} contentFit="cover" accessibilityLabel={`Evidence ${index + 1}`} />
                ))}
              </ScrollView>
            ) : null}
            <Text size={13} weight={500} lineHeight={16.9} color={colors.primary} accessibilityRole="link" onPress={() => navigation.navigate("EscrowStatus", { orderId: dispute.orderId })}>
              View payment status
            </Text>
          </View>

          <View style={styles.card}>
            <Text size={16} weight={600} lineHeight={19.2} accessibilityRole="header">Status</Text>
            <DisputeStatusHistory events={dispute.statusHistory} />
            {dispute.resolutionNote ? <Text size={13} lineHeight={17} color={colors.textMuted}>{dispute.resolutionNote}</Text> : null}
          </View>

          <Text size={16} weight={600} lineHeight={19.2} accessibilityRole="header">Messages with support</Text>
          <View style={styles.messages}>
            {dispute.messages.map((message) => (
              <DisputeMessageBubble key={message.id} message={message} sentByViewer={message.authorRole === dispute.viewerRole} />
            ))}
          </View>
        </ScrollView>
        {isResolved ? null : (
          <View style={styles.composer}>
            <TextInput
              value={draftMessage}
              onChangeText={setDraftMessage}
              placeholder={sellerMustRespond ? "Reply to the buyer and support…" : "Write a message…"}
              placeholderTextColor={colors.textSubtle}
              multiline
              maxLength={1000}
              accessibilityLabel="Message"
              style={styles.input}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send message"
              disabled={!draftMessage.trim() || sendMessage.isPending}
              onPress={() => sendMessage.mutate(draftMessage.trim())}
              style={[styles.send, (!draftMessage.trim() || sendMessage.isPending) && styles.sendDisabled]}
            >
              {sendMessage.isPending ? <ActivityIndicator color={colors.white} /> : <PaperPlaneTilt24Icon size={20} color={colors.white} />}
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 16 },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  description: { marginTop: 4 },
  evidence: { gap: 8 },
  evidencePhoto: { width: 96, height: 96, borderRadius: 8 },
  messages: { gap: 14 },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider },
  input: { flex: 1, minHeight: 40, maxHeight: 120, borderRadius: 20, borderWidth: 1, borderColor: colors.divider, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, fontFamily: fontFamily[400], fontSize: 14, color: colors.text },
  send: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primarySolid, alignItems: "center", justifyContent: "center" },
  sendDisabled: { backgroundColor: colors.disabled },
}));
