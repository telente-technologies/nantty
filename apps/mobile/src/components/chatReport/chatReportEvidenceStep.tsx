import { Pressable, StyleSheet, View } from "react-native";

import type { LocallyStoredMessage } from "@/cache/messageHistory.type";
import { Check16Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { listReportableMessagesOldestFirst } from "@/utils/chatReportEvidence.util";

import type { ChatReportDraft } from "./chatReportDraft.hook";
import {
  CHAT_REPORT_ENCRYPTION_NOTICE,
  CHAT_REPORT_EVIDENCE_CONSENT_NOTICE,
  LAST_MESSAGES_COUNT_CHOICES,
  MAXIMUM_PICKED_EVIDENCE_MESSAGES,
} from "./chatReportReasons.constant";

export interface ChatReportEvidenceStepProps {
  readonly draft: ChatReportDraft;
  readonly messages: readonly LocallyStoredMessage[];
  readonly selectedEvidenceCount: number;
}

const describeMessageForPicker = (message: LocallyStoredMessage) => {
  if (message.text.trim()) return message.text;
  if (message.document) return `Document: ${message.document.fileName}`;
  if (message.poll) return `Poll: ${message.poll.question}`;
  if (message.location) return "Location";
  return message.media ? `${message.media.type[0]!.toUpperCase()}${message.media.type.slice(1)} attachment` : "Attachment";
};

const formatPickerTimestamp = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function ChatReportEvidenceStep({ draft, messages, selectedEvidenceCount }: ChatReportEvidenceStepProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const pickableMessages = listReportableMessagesOldestFirst(messages).slice(-MAXIMUM_PICKED_EVIDENCE_MESSAGES).reverse();
  const modeChoices = [
    { mode: "last_messages" as const, label: "Last messages" },
    { mode: "picked_messages" as const, label: "Pick messages" },
  ];
  return (
    <View style={styles.root}>
      <Text size={13} lineHeight={18} color={colors.textMuted}>{CHAT_REPORT_ENCRYPTION_NOTICE}</Text>
      <View style={styles.modeRow} accessibilityRole="tablist">
        {modeChoices.map((choice) => {
          const isActive = draft.evidenceMode === choice.mode;
          return (
            <Pressable
              key={choice.mode}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              onPress={() => draft.setEvidenceMode(choice.mode)}
              style={[styles.modeChip, isActive ? styles.modeChipActive : null]}
            >
              <Text size={13} weight={isActive ? 600 : 400} lineHeight={16.9} color={isActive ? colors.primary : colors.text}>{choice.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {draft.evidenceMode === "last_messages" ? (
        <View style={styles.modeRow}>
          {LAST_MESSAGES_COUNT_CHOICES.map((count) => {
            const isActive = draft.lastMessagesCount === count;
            return (
              <Pressable
                key={count}
                accessibilityRole="button"
                accessibilityLabel={`Last ${count} messages`}
                accessibilityState={{ selected: isActive }}
                onPress={() => draft.setLastMessagesCount(count)}
                style={[styles.modeChip, isActive ? styles.modeChipActive : null]}
              >
                <Text size={13} weight={isActive ? 600 : 400} lineHeight={16.9} color={isActive ? colors.primary : colors.text}>Last {count}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View>
          {pickableMessages.map((message) => {
            const isPicked = draft.pickedMessageIds.has(message.id);
            return (
              <Pressable
                key={message.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isPicked }}
                onPress={() => draft.togglePickedMessage(message.id)}
                style={styles.messageRow}
              >
                <View style={styles.messageText}>
                  <Text size={12} lineHeight={16} color={colors.textMuted}>
                    {message.sender?.name ?? "You"} · {formatPickerTimestamp(message.createdAt)}
                  </Text>
                  <Text size={14} lineHeight={19} numberOfLines={2}>{describeMessageForPicker(message)}</Text>
                </View>
                <View style={[styles.checkbox, isPicked ? styles.checkboxOn : null]}>{isPicked ? <Check16Icon color={colors.onPrimary} /> : null}</View>
              </Pressable>
            );
          })}
        </View>
      )}
      <View style={styles.consent}>
        <Text size={13} lineHeight={18} weight={500}>{CHAT_REPORT_EVIDENCE_CONSENT_NOTICE}</Text>
        <Text size={12} lineHeight={16} color={colors.textMuted}>
          {selectedEvidenceCount} {selectedEvidenceCount === 1 ? "message" : "messages"} selected. Text, attachment details, times and sender ids are included.
        </Text>
      </View>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  root: { gap: 12 },
  modeRow: { flexDirection: "row", gap: 8 },
  modeChip: { height: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: colors.chip, justifyContent: "center" },
  modeChipActive: { borderWidth: 1, borderColor: colors.primary },
  messageRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.divider },
  messageText: { flex: 1, gap: 2 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.textMuted, alignItems: "center", justifyContent: "center" },
  checkboxOn: { backgroundColor: colors.primarySolid, borderColor: colors.primarySolid },
  consent: { padding: 14, borderRadius: 14, backgroundColor: colors.chip, gap: 6 },
}));
