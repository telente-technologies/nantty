import { useMutation } from "@tanstack/react-query";
import { Pressable, StyleSheet, View } from "react-native";

import { Check16Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { messagesService } from "@/services/chat/messages.service";
import { makeThemedStyles, useTheme } from "@/theme";
import type { LocalMessageDeliveryStatus } from "@/cache/messageHistory.type";
import type { Message } from "@/types";
import { showAlertWithButtons } from "@/utils/crossPlatformAlert.util";

import { useConversationMessageCache } from "./conversationMessageCache.hook";

export function PollBubble({ message, deliveryStatus }: { readonly message: Message; readonly deliveryStatus: LocalMessageDeliveryStatus }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const poll = message.poll!;
  const { replaceCachedMessage } = useConversationMessageCache(message.conversationId);
  const totalVotes = poll.options.reduce((sum, option) => sum + option.voteCount, 0);
  const vote = useMutation({
    mutationFn: (optionId: string) => messagesService.voteOnPoll(message.id, optionId),
    onSuccess: (updatedPoll) => replaceCachedMessage(message.id, { ...message, poll: updatedPoll, deliveryStatus }),
    onError: () => showAlertWithButtons("Couldn't record your vote", "Please try again."),
  });
  const canVote = deliveryStatus === "sent" && !vote.isPending;

  return (
    <View style={styles.root}>
      <Text size={14} weight={600} lineHeight={18.2}>{poll.question}</Text>
      <Text size={12} lineHeight={15.6} letterSpacing={0} color={colors.textMuted}>
        {poll.allowMultipleAnswers ? "Select one or more" : "Select one"}
      </Text>
      {poll.options.map((option) => {
        const fraction = totalVotes > 0 ? option.voteCount / totalVotes : 0;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: option.votedByMe, disabled: !canVote }}
            accessibilityLabel={`${option.text}, ${option.voteCount} ${option.voteCount === 1 ? "vote" : "votes"}`}
            disabled={!canVote}
            onPress={() => vote.mutate(option.id)}
            style={styles.option}
          >
            <View style={[styles.optionFill, { width: `${Math.round(fraction * 100)}%` }]} />
            <View style={styles.optionContent}>
              <View style={[styles.checkCircle, option.votedByMe && styles.checkCircleOn]}>
                {option.votedByMe ? <Check16Icon size={12} color={colors.white} /> : null}
              </View>
              <Text size={13} lineHeight={16.9} style={styles.optionText}>{option.text}</Text>
              <Text size={12} weight={600} lineHeight={15.6} letterSpacing={0}>{option.voteCount}</Text>
            </View>
          </Pressable>
        );
      })}
      <Text size={11} lineHeight={14.3} letterSpacing={0} color={colors.textMuted}>
        {totalVotes} {totalVotes === 1 ? "vote" : "votes"}
      </Text>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  root: { width: 232, gap: 8 },
  option: { borderRadius: 8, backgroundColor: colors.placeholder, overflow: "hidden", minHeight: 36, justifyContent: "center" },
  optionFill: { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: colors.primaryTint },
  optionContent: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, paddingVertical: 8 },
  optionText: { flex: 1 },
  checkCircle: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: colors.textMuted, alignItems: "center", justifyContent: "center" },
  checkCircleOn: { backgroundColor: colors.primary, borderColor: colors.primary },
}));
