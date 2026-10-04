import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";

import { formatFriendlyDateTime } from "@/components/escrow/escrowStage.util";
import { StatusPill } from "@/components/escrow/statusPill";
import { PaperPlaneTilt24Icon } from "@/components/icons";
import { SupportRecordingNotice } from "@/components/support/supportRecordingNotice";
import { TicketRatingCard } from "@/components/support/ticketRatingCard";
import { supportUnreadQueryKey } from "@/hooks/useSupportUnread.hook";
import { TICKET_STATUS_APPEARANCE } from "@/components/settings/supportAppearance.util";
import { Header } from "@/components/ui/header";
import { KeyboardSpacer } from "@/components/ui/keyboardSpacer";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { fontFamily } from "@/constants/typography.constant";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { generateIdempotencyKey } from "@/services/apiClient.service";
import { supportService } from "@/services/support.service";
import { ListSkeleton } from "@/components/ui/listSkeleton";

const LIVE_CHAT_POLL_MS = 3000;

export function SupportTicketDetailScreen({ route }: MainScreenProps<"SupportTicketDetail">) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { ticketId } = route.params;
  const ticket = useQuery({ queryKey: ["support", "tickets", ticketId], queryFn: () => supportService.fetchSupportTicket(ticketId), refetchInterval: LIVE_CHAT_POLL_MS });
  const queryClient = useQueryClient();
  const unreadCount = ticket.data?.unreadCount ?? 0;
  useEffect(() => {
    if (unreadCount === 0) return;
    void supportService.markSupportTicketRead(ticketId).then(() => {
      void queryClient.invalidateQueries({ queryKey: supportUnreadQueryKey });
      void queryClient.invalidateQueries({ queryKey: ["support", "tickets"], exact: true });
    }).catch(() => undefined);
  }, [unreadCount, ticketId, queryClient]);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<ScrollView>(null);
  const isComposing = useRef(false);
  const keepLatestMessageVisible = () => {
    if (isComposing.current) scrollRef.current?.scrollToEnd({ animated: false });
  };
  const reply = useMutation({
    mutationFn: (text: string) => supportService.replyToSupportTicket(ticketId, text, generateIdempotencyKey()),
    onSuccess: () => {
      setDraft("");
      ticket.refetch();
    },
  });

  if (!ticket.data) {
    return (
      <Screen>
        <Header title="Support" />
        <ListSkeleton />
      </Screen>
    );
  }
  const details = ticket.data;
  const closed = details.canReply === false || details.status === "closed";
  return (
    <Screen>
      <Header title="Support" />
      <View style={styles.flex}>
        <ScrollView ref={scrollRef} onLayout={keepLatestMessageVisible} keyboardDismissMode="interactive" contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <Text size={16} weight={600} lineHeight={19.2}>{details.subject}</Text>
            <StatusPill label={TICKET_STATUS_APPEARANCE[details.status].label} tone={TICKET_STATUS_APPEARANCE[details.status].tone} />
            {details.linkedReference ? <Text size={12} lineHeight={16.8} color={colors.textMuted}>Linked to {details.linkedReference.label}</Text> : null}
          </View>
          <SupportRecordingNotice />
          {details.messages.map((message) => (
            <View key={message.id} style={[styles.bubbleWrap, !message.fromSupport && styles.mine]}>
              <Text size={11} lineHeight={14} color={colors.textSubtle}>{message.authorName}</Text>
              <View style={[styles.bubble, { backgroundColor: message.fromSupport ? colors.successTint : colors.primarySolid }]}>
                <Text size={14} lineHeight={19} color={message.fromSupport ? colors.text : colors.white}>{message.text}</Text>
              </View>
              <Text size={11} lineHeight={14} color={colors.textSubtle}>{formatFriendlyDateTime(message.createdAt)}</Text>
            </View>
          ))}
          {details.canRate ? <TicketRatingCard ticketId={ticketId} onRated={() => ticket.refetch()} /> : null}
          {details.satisfactionScore ? <Text size={12} lineHeight={16.8} color={colors.textSubtle}>You rated this {details.satisfactionScore} out of 5. Thank you.</Text> : null}
          {closed ? <Text size={12} lineHeight={16.8} color={colors.textSubtle}>This request is closed. Contact support again if you still need help.</Text> : null}
          {details.agentTyping ? <Text size={12} lineHeight={16.8} color={colors.textSubtle} accessibilityLiveRegion="polite">Zudomart Support is typing…</Text> : null}
        </ScrollView>
        {closed ? null : (
          <View style={styles.composer}>
            <TextInput value={draft} onChangeText={setDraft} onFocus={() => { isComposing.current = true; }} onBlur={() => { isComposing.current = false; }} placeholder="Message Zudomart Support…" placeholderTextColor={colors.textSubtle} multiline accessibilityLabel="Reply" style={styles.input} />
            <Pressable accessibilityRole="button" accessibilityLabel="Send reply" disabled={!draft.trim() || reply.isPending} onPress={() => reply.mutate(draft.trim())} style={[styles.send, !draft.trim() && styles.sendDisabled]}>
              <PaperPlaneTilt24Icon size={20} color={colors.white} />
            </Pressable>
          </View>
        )}
        <KeyboardSpacer style={styles.keyboardArea} />
      </View>
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  flex: { flex: 1 },
  keyboardArea: { backgroundColor: colors.surface },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 14 },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, gap: 8 },
  bubbleWrap: { maxWidth: "85%", gap: 4 },
  mine: { alignSelf: "flex-end", alignItems: "flex-end" },
  bubble: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider },
  input: { flex: 1, minHeight: 40, maxHeight: 120, borderRadius: 20, borderWidth: 1, borderColor: colors.divider, paddingHorizontal: 14, paddingVertical: 10, fontFamily: fontFamily[400], fontSize: 14, color: colors.text },
  send: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primarySolid, alignItems: "center", justifyContent: "center" },
  sendDisabled: { backgroundColor: colors.disabled },
}));
