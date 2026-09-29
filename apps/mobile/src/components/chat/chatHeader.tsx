import { Pressable, StyleSheet, View } from "react-native";

import { ArrowLeft24Icon, DotsThreeVertical24Icon } from "@/components/icons";
import { VerificationBadge } from "@/components/profile/verificationBadge";
import { Avatar } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { Conversation, UserSummary } from "@/types";

import { BusinessLabel } from "./businessLabel";
import { describeConversationForDisplay } from "./conversationDisplay.util";

export interface ChatHeaderProps {
  readonly conversation: Conversation | undefined;
  readonly fallbackName: string;
  readonly usersTyping: readonly UserSummary[];
  readonly onGoBack: () => void;
  readonly onOpenConversationInfo: () => void;
}

const describeWhoIsTyping = (usersTyping: readonly UserSummary[], isGroupLike: boolean) => {
  if (usersTyping.length === 0) return null;
  if (!isGroupLike) return "typing…";
  const firstNames = usersTyping.map((user) => user.name.split(" ")[0]);
  return firstNames.length === 1 ? `${firstNames[0]} is typing…` : `${firstNames.length} people are typing…`;
};

export function ChatHeader({ conversation, fallbackName, usersTyping, onGoBack, onOpenConversationInfo }: ChatHeaderProps) {
  const display = conversation ? describeConversationForDisplay(conversation) : null;
  const typingText = describeWhoIsTyping(usersTyping, !!display && (display.isGroup || display.isChannel));
  const secondLine = typingText ?? display?.subtitle ?? null;
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" hitSlop={12} onPress={onGoBack}>
          <ArrowLeft24Icon />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Conversation info" onPress={onOpenConversationInfo} style={styles.peer}>
          <Avatar uri={display?.avatarUrl ?? null} size={secondLine ? 32 : 24} placeholderColor={colors.placeholder} />
          <View style={styles.titleColumn}>
            <View style={styles.nameRow}>
              <Text size={14} weight={500} lineHeight={16.8} numberOfLines={1} style={styles.name}>
                {display?.displayName ?? fallbackName}
              </Text>
              {conversation && display && !display.isGroup && !display.isChannel ? (
                <VerificationBadge verification={conversation.peer.verification} legacyVerified={conversation.peer.verified} size={16} />
              ) : null}
              {display?.isBusiness ? <BusinessLabel /> : null}
            </View>
            {secondLine ? (
              <Text size={11} lineHeight={14} letterSpacing={0} color={typingText ? colors.primary : colors.textMuted} numberOfLines={1}>
                {secondLine}
              </Text>
            ) : null}
          </View>
        </Pressable>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Conversation options" hitSlop={10} onPress={onOpenConversationInfo}>
        <DotsThreeVertical24Icon />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: 12, minHeight: 24, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 18, flexShrink: 1 },
  peer: { flexDirection: "row", alignItems: "center", gap: 13, flexShrink: 1 },
  titleColumn: { flexShrink: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  name: { flexShrink: 1 },
});
