import { useMutation, useQueryClient } from "@tanstack/react-query";
import { StyleSheet, View } from "react-native";

import { useChatReportLauncher } from "@/components/chatReport/chatReportLauncher.hook";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import { messagesService } from "@/services/chat/messages.service";
import type { Conversation } from "@/types";
import { showAlertWithButtons } from "@/utils/crossPlatformAlert.util";

export interface InboxRequestActionsProps {
  readonly conversation: Conversation;
  readonly onRemoved?: () => void;
  readonly showExplanation?: boolean;
}

export function InboxRequestActions({ conversation, onRemoved, showExplanation = false }: InboxRequestActionsProps) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const report = useChatReportLauncher(conversation);
  const isSpam = conversation.inboxFolder === "spam";
  const refreshInbox = () => {
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
    queryClient.invalidateQueries({ queryKey: ["conversation"] });
  };
  const accept = useMutation({ mutationFn: () => messagesService.acceptMessageRequest(conversation.id), onSuccess: refreshInbox });
  const notSpam = useMutation({ mutationFn: () => messagesService.markConversationNotSpam(conversation.id), onSuccess: refreshInbox });
  const remove = useMutation({
    mutationFn: () => messagesService.deleteMessageRequest(conversation.id),
    onSuccess: () => {
      refreshInbox();
      onRemoved?.();
    },
  });
  const block = useMutation({
    mutationFn: () => messagesService.blockConversationPeer(conversation.id),
    onSuccess: () => {
      refreshInbox();
      queryClient.invalidateQueries({ queryKey: ["users", "me", "blocked"] });
      onRemoved?.();
    },
  });
  const confirmBlock = () =>
    showAlertWithButtons(`Block ${conversation.peer.name}?`, "They won't be able to message you. You can unblock them in chat settings.", [
      { text: "Cancel", style: "cancel" },
      { text: "Block", style: "destructive", onPress: () => block.mutate() },
    ], { intent: "block" });
  const isBusy = accept.isPending || notSpam.isPending || remove.isPending || block.isPending;
  return (
    <View style={styles.root}>
      {showExplanation ? (
        <Text size={12} lineHeight={16} color={colors.textMuted}>
          {isSpam ? conversation.spamReason ?? "Flagged by Nantty based on this account's activity." : "They won't see that you've read this until you accept."}
        </Text>
      ) : null}
      <View style={styles.buttons}>
        {isSpam ? (
          <Button title="Not spam" height={36} style={styles.button} disabled={isBusy} onPress={() => notSpam.mutate()} />
        ) : (
          <Button title="Accept" height={36} style={styles.button} disabled={isBusy} onPress={() => accept.mutate()} />
        )}
        <Button title="Delete" variant="outline" height={36} style={styles.button} disabled={isBusy} onPress={() => remove.mutate()} />
        <Button title="Block" variant="danger" height={36} style={styles.button} disabled={isBusy} onPress={confirmBlock} />
      </View>
      <View style={styles.buttons}>
        <Button title="Report" variant="outline" height={36} style={styles.button} disabled={isBusy} onPress={() => report.reportUser(false)} />
        <Button title="Report and block" variant="outline" height={36} style={styles.button} disabled={isBusy} onPress={() => report.reportUser(true)} />
      </View>
      {report.reportSheet}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 8, paddingTop: 8 },
  buttons: { flexDirection: "row", gap: 8 },
  button: { flex: 1 },
});
