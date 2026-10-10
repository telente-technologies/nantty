import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { ChatMuteSheet } from "@/components/chatSafety/chatMuteSheet";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { chatReportsService } from "@/services/chat/chatReports.service";
import { messagesService } from "@/services/chat/messages.service";

import type { ChatReportTarget } from "./chatReportTarget.type";

export interface ChatReportDoneStepProps {
  readonly target: ChatReportTarget;
  readonly isUrgent: boolean;
  readonly onClose: () => void;
  readonly onOpenMyReports: () => void;
}

export function ChatReportDoneStep({ target, isUrgent, onClose, onOpenMyReports }: ChatReportDoneStepProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [isMuteSheetOpen, setIsMuteSheetOpen] = useState(false);
  const isAboutPerson = !!target.reportedUser && target.kind !== "group";
  const block = useMutation({ mutationFn: () => messagesService.blockConversationPeer(target.conversationId) });
  const restrict = useMutation({ mutationFn: () => chatReportsService.restrictConversationPeer(target.conversationId) });
  const alreadyBlocked = target.alsoBlock || block.isSuccess;
  const personActions = [
    { label: alreadyBlocked ? "Blocked" : "Block", isDone: alreadyBlocked, isBusy: block.isPending, onPress: () => block.mutate(), hint: "They can't message you" },
    { label: "Mute", isDone: false, isBusy: false, onPress: () => setIsMuteSheetOpen(true), hint: "Stop notifications from this chat" },
    { label: restrict.isSuccess ? "Restricted" : "Restrict", isDone: restrict.isSuccess, isBusy: restrict.isPending, onPress: () => restrict.mutate(), hint: "Their messages go to Requests" },
  ];
  const safetyActions = isAboutPerson ? personActions : personActions.filter((action) => action.label === "Mute");
  return (
    <View style={styles.root}>
      <Text size={20} weight={600} lineHeight={26}>Thanks, we'll review this</Text>
      <Text size={14} lineHeight={19.6} color={colors.textMuted}>
        {isUrgent ? "Your report was marked urgent and goes to the front of the queue. " : ""}
        Our safety team will look at what you sent. The other person won't be told who reported them.
      </Text>
      <View style={styles.actions}>
        {safetyActions.map((action) => (
          <Pressable
            key={action.label}
            accessibilityRole="button"
            accessibilityHint={action.hint}
            disabled={action.isDone || action.isBusy}
            onPress={action.onPress}
            style={[styles.actionRow, action.isDone ? styles.actionRowDone : null]}
          >
            <Text size={14} weight={500} lineHeight={16.8} color={action.isDone ? colors.textMuted : colors.text}>{action.label}</Text>
            <Text size={12} lineHeight={16} color={colors.textSubtle}>{action.hint}</Text>
          </Pressable>
        ))}
      </View>
      <Text size={14} weight={500} lineHeight={16.8} color={colors.primary} accessibilityRole="link" onPress={onOpenMyReports}>
        See the status in Your reports
      </Text>
      <Button title="Done" onPress={onClose} />
      <ChatMuteSheet
        visible={isMuteSheetOpen}
        onClose={() => setIsMuteSheetOpen(false)}
        conversationId={target.conversationId}
        isMuted={false}
      />
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  root: { gap: 14 },
  actions: { gap: 8 },
  actionRow: { padding: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.divider, gap: 2 },
  actionRowDone: { opacity: 0.6 },
}));
