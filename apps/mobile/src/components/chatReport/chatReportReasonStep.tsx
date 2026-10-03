import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { Check16Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { calculateDefaultLetterSpacing, fontFamily } from "@/constants/typography.constant";
import { makeThemedStyles, useTheme } from "@/theme";
import type { ChatReportReason } from "@/types";

import {
  CHAT_REPORT_REASON_OPTIONS,
  CHILD_SAFETY_PRIORITY_NOTICE,
  MAXIMUM_CHAT_REPORT_DETAILS_LENGTH,
  SELF_HARM_SUPPORT_NOTICE,
} from "./chatReportReasons.constant";

export interface ChatReportReasonStepProps {
  readonly reason: ChatReportReason | null;
  readonly details: string;
  readonly onChangeReason: (reason: ChatReportReason) => void;
  readonly onChangeDetails: (details: string) => void;
}

export function ChatReportReasonStep({ reason, details, onChangeReason, onChangeDetails }: ChatReportReasonStepProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const isOther = reason === "other";
  return (
    <View style={styles.root}>
      <View accessibilityRole="radiogroup">
        {CHAT_REPORT_REASON_OPTIONS.map((option) => {
          const isSelected = option.reason === reason;
          return (
            <Pressable
              key={option.reason}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
              onPress={() => onChangeReason(option.reason)}
              style={styles.reasonRow}
            >
              <View style={styles.reasonLabel}>
                <Text size={14} lineHeight={16.8} weight={isSelected ? 600 : 400}>{option.label}</Text>
                {option.isUrgent ? <Text size={11} weight={600} lineHeight={14} color={colors.error}>Urgent</Text> : null}
              </View>
              {isSelected ? <Check16Icon color={colors.primary} /> : null}
            </Pressable>
          );
        })}
      </View>
      {reason === "self_harm" ? (
        <View style={styles.notice} accessibilityLiveRegion="polite">
          <Text size={13} lineHeight={18}>{SELF_HARM_SUPPORT_NOTICE}</Text>
        </View>
      ) : null}
      {reason === "child_safety" ? (
        <View style={styles.notice} accessibilityLiveRegion="polite">
          <Text size={13} lineHeight={18}>{CHILD_SAFETY_PRIORITY_NOTICE}</Text>
        </View>
      ) : null}
      <TextInput
        value={details}
        onChangeText={(text) => onChangeDetails(text.slice(0, MAXIMUM_CHAT_REPORT_DETAILS_LENGTH))}
        placeholder={isOther ? "Tell us what happened (required)" : "Add details (optional)"}
        placeholderTextColor={colors.textSubtle}
        selectionColor={colors.primary}
        multiline
        maxLength={MAXIMUM_CHAT_REPORT_DETAILS_LENGTH}
        accessibilityLabel="Report details"
        style={styles.detailsInput}
      />
      <Text size={12} lineHeight={16.8} color={colors.textSubtle} align="right">
        {details.length}/{MAXIMUM_CHAT_REPORT_DETAILS_LENGTH}
      </Text>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  root: { gap: 12 },
  reasonRow: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: colors.divider },
  reasonLabel: { flexDirection: "row", alignItems: "center", gap: 8 },
  notice: { padding: 12, borderRadius: 8, backgroundColor: colors.chip },
  detailsInput: {
    minHeight: 88,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 8,
    textAlignVertical: "top",
    fontFamily: fontFamily[400],
    fontSize: 14,
    letterSpacing: calculateDefaultLetterSpacing(14),
    color: colors.text,
  },
}));
