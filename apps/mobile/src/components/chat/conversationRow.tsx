import { Pressable, StyleSheet, View } from "react-native";

import { StreakBadge } from "@/components/chatSafety/streakBadge";
import { VerificationBadge } from "@/components/profile/verificationBadge";
import { Avatar } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { Conversation } from "@/types";
import { formatTimeSincePosted } from "@/utils/formatDate.util";

import { BusinessLabel } from "./businessLabel";
import { describeConversationForDisplay } from "./conversationDisplay.util";
import { BellSlash24Icon } from "@/components/icons";

export interface ConversationRowProps {
  readonly conversation: Conversation;
  readonly onPress: () => void;
}

export function ConversationRow({ conversation, onPress }: ConversationRowProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { lastMessage, lastMessageAt, unread } = conversation;
  const display = describeConversationForDisplay(conversation);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${display.displayName}${display.isBusiness ? ", business" : ""}, ${lastMessage}${unread > 0 ? `, ${unread} unread` : ""}`}
      onPress={onPress}
      style={styles.row}
    >
      <Avatar uri={display.avatarUrl} size={56} placeholderColor={colors.primaryTint} />
      <View style={styles.body}>
        <View style={styles.topLine}>
          <View style={styles.nameWithBadge}>
            <Text size={16} weight={500} lineHeight={19.2} numberOfLines={1} style={styles.name}>
              {display.displayName}
            </Text>
            {display.isGroup || display.isChannel ? null : (
              <VerificationBadge verification={conversation.peer.verification} legacyVerified={conversation.peer.verified} size={16} />
            )}
            {display.isBusiness ? <BusinessLabel /> : null}
            <StreakBadge streak={conversation.streak} />
            {conversation.mutedUntil ? <View accessible accessibilityLabel="Muted"><BellSlash24Icon size={14} color={colors.textMuted} /></View> : null}
          </View>
          <Text size={13} weight={500} lineHeight={16.9} color={colors.textSubtle}>
            {formatTimeSincePosted(lastMessageAt)} ago
          </Text>
        </View>
        <View style={styles.bottomLine}>
          <Text size={14} weight={500} lineHeight={16.8} color={colors.textSubtle} numberOfLines={1} style={styles.message}>
            {lastMessage}
          </Text>
          {unread > 0 ? (
            <View style={styles.badge}>
              <Text size={13} weight={500} lineHeight={16.9}>
                {unread.toLocaleString("en-US")}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  row: { height: 56, flexDirection: "row", alignItems: "center", gap: 8 },
  body: { flex: 1, gap: 4 },
  topLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  name: { flexShrink: 1 },
  nameWithBadge: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1 },
  bottomLine: { flexDirection: "row", alignItems: "center", gap: 4 },
  message: { flex: 1 },
  badge: { minWidth: 21, height: 21, paddingHorizontal: 4, borderRadius: 999, backgroundColor: colors.chip, alignItems: "center", justifyContent: "center" },
}));
