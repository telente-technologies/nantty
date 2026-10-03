import { Pressable, StyleSheet, View } from "react-native";

import { StreakBadge } from "@/components/chatSafety/streakBadge";
import { ArrowLeft24Icon, Bell24Icon, DotsThreeVertical24Icon } from "@/components/icons";
import { VerificationBadge } from "@/components/profile/verificationBadge";
import { Avatar } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import { useOpenUserProfile } from "@/hooks/useOpenUserProfile.hook";
import type { Conversation, UserSummary } from "@/types";

import { BusinessLabel } from "./businessLabel";
import { describeConversationForDisplay } from "./conversationDisplay.util";
import { TypingDots } from "./typingDots";

export interface ChatHeaderProps {
  readonly conversation: Conversation | undefined;
  readonly fallbackName: string;
  readonly usersTyping: readonly UserSummary[];
  readonly onGoBack: () => void;
  readonly onOpenConversationInfo: () => void;
  readonly onOpenStreak?: () => void;
  readonly onOpenMute?: () => void;
}

const describeWhoIsTyping = (usersTyping: readonly UserSummary[], isGroupLike: boolean) => {
  if (usersTyping.length === 0) return null;
  if (!isGroupLike) return "typing…";
  const firstNames = usersTyping.map((user) => user.name.split(" ")[0]);
  return firstNames.length === 1 ? `${firstNames[0]} is typing…` : `${firstNames.length} people are typing…`;
};

export function ChatHeader({ conversation, fallbackName, usersTyping, onGoBack, onOpenConversationInfo, onOpenStreak, onOpenMute }: ChatHeaderProps) {
  const { colors } = useTheme();
  const display = conversation ? describeConversationForDisplay(conversation) : null;
  const isGroupLike = !!display && (display.isGroup || display.isChannel);
  const typingText = describeWhoIsTyping(usersTyping, isGroupLike);
  const secondLine = typingText ?? display?.subtitle ?? null;
  const showTypingDots = usersTyping.length > 0;
  const subtitle = showTypingDots && !isGroupLike ? null : secondLine;
  const openUserProfile = useOpenUserProfile();
  const isDirectConversationWithPerson = !!conversation && !!display && !display.isGroup && !display.isChannel && conversation.kind !== "business";
  const openPeerProfileOrConversationInfo = () =>
    isDirectConversationWithPerson ? openUserProfile(conversation.peer.id) : onOpenConversationInfo();
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" hitSlop={12} onPress={onGoBack}>
          <ArrowLeft24Icon />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={isDirectConversationWithPerson ? "View profile" : "Conversation info"} onPress={openPeerProfileOrConversationInfo} style={styles.peer}>
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
              {conversation?.streak && conversation.streak.state !== "none" ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Streak details" hitSlop={8} onPress={onOpenStreak}>
                  <StreakBadge streak={conversation.streak} />
                </Pressable>
              ) : null}
            </View>
            {showTypingDots || subtitle ? (
              <View style={styles.subtitleRow}>
                {showTypingDots ? <TypingDots /> : null}
                {subtitle ? (
                  <Text size={11} lineHeight={14} letterSpacing={0} color={typingText ? colors.primary : colors.textMuted} numberOfLines={1}>
                    {subtitle}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
        </Pressable>
      </View>
      <View style={styles.actions}>
        {conversation && onOpenMute ? (
          <Pressable accessibilityRole="button" accessibilityLabel={conversation.mutedUntil ? "Chat muted, change mute" : "Mute chat"} hitSlop={10} onPress={onOpenMute} style={conversation.mutedUntil ? styles.muted : undefined}>
            <Bell24Icon />
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Conversation options" hitSlop={10} onPress={onOpenConversationInfo}>
          <DotsThreeVertical24Icon />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: 12, minHeight: 24, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 18, flexShrink: 1 },
  peer: { flexDirection: "row", alignItems: "center", gap: 13, flexShrink: 1 },
  titleColumn: { flexShrink: 1 },
  subtitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  name: { flexShrink: 1 },
  actions: { flexDirection: "row", alignItems: "center", gap: 12 },
  muted: { opacity: 0.35 },
});
