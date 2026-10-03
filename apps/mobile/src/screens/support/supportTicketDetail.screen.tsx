import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";

import { formatFriendlyDateTime } from "@/components/escrow/escrowStage.util";
import { StatusPill } from "@/components/escrow/statusPill";
import { PaperPlaneTilt24Icon } from "@/components/icons";
import { TICKET_STATUS_APPEARANCE } from "@/components/settings/supportAppearance.util";
import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { colors, palette } from "@/constants/colors.constant";
import { fontFamily } from "@/constants/typography.constant";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { generateIdempotencyKey } from "@/services/apiClient.service";
import { supportService } from "@/services/support.service";
import { ListSkeleton } from "@/components/ui/listSkeleton";

export function SupportTicketDetailScreen({ route }: MainScreenProps<"SupportTicketDetail">) {
  const { ticketId } = route.params;
  const ticket = useQuery({ queryKey: ["support", "tickets", ticketId], queryFn: () => supportService.fetchSupportTicket(ticketId) });
  const [draft, setDraft] = useState("");
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
  const closed = details.status === "closed";
  return (
    <Screen>
      <Header title="Support" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <Text size={16} weight={600} lineHeight={19.2}>{details.subject}</Text>
            <StatusPill label={TICKET_STATUS_APPEARANCE[details.status].label} tone={TICKET_STATUS_APPEARANCE[details.status].tone} />
          </View>
          {details.messages.map((message) => (
            <View key={message.id} style={[styles.bubbleWrap, !message.fromSupport && styles.mine]}>
              <Text size={11} lineHeight={14} color={colors.textSubtle}>{message.authorName}</Text>
              <View style={[styles.bubble, { backgroundColor: message.fromSupport ? palette.success[50] : colors.primary }]}>
                <Text size={14} lineHeight={19} color={message.fromSupport ? colors.text : colors.white}>{message.text}</Text>
              </View>
              <Text size={11} lineHeight={14} color={colors.textSubtle}>{formatFriendlyDateTime(message.createdAt)}</Text>
            </View>
          ))}
        </ScrollView>
        {closed ? null : (
          <View style={styles.composer}>
            <TextInput value={draft} onChangeText={setDraft} placeholder="Reply to support…" placeholderTextColor={colors.textSubtle} multiline accessibilityLabel="Reply" style={styles.input} />
            <Pressable accessibilityRole="button" accessibilityLabel="Send reply" disabled={!draft.trim() || reply.isPending} onPress={() => reply.mutate(draft.trim())} style={[styles.send, !draft.trim() && styles.sendDisabled]}>
              <PaperPlaneTilt24Icon size={20} color={colors.white} />
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 14 },
  card: { backgroundColor: colors.white, borderRadius: 12, padding: 16, gap: 8 },
  bubbleWrap: { maxWidth: "85%", gap: 4 },
  mine: { alignSelf: "flex-end", alignItems: "flex-end" },
  bubble: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.divider },
  input: { flex: 1, minHeight: 40, maxHeight: 120, borderRadius: 20, borderWidth: 1, borderColor: colors.divider, paddingHorizontal: 14, paddingVertical: 10, fontFamily: fontFamily[400], fontSize: 14, color: colors.text },
  send: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  sendDisabled: { backgroundColor: colors.disabled },
});
