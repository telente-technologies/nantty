import { Pressable, StyleSheet, View } from "react-native";

import { Avatar } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { Conversation } from "@/types";
import { formatTimeSincePosted } from "@/utils/formatDate.util";

export interface ConversationRowProps {
  readonly conversation: Conversation;
  readonly onPress: () => void;
}

export function ConversationRow({ conversation, onPress }: ConversationRowProps) {
  const { peer, lastMessage, lastMessageAt, unread } = conversation;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${peer.name}, ${lastMessage}${unread > 0 ? `, ${unread} unread` : ""}`}
      onPress={onPress}
      style={styles.row}
    >
      <Avatar uri={peer.avatarUrl} size={56} placeholderColor={colors.primaryTint} />
      <View style={styles.body}>
        <View style={styles.topLine}>
          <Text size={16} weight={500} lineHeight={19.2} numberOfLines={1} style={styles.name}>
            {peer.name}
          </Text>
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

const styles = StyleSheet.create({
  row: { height: 56, flexDirection: "row", alignItems: "center", gap: 8 },
  body: { flex: 1, gap: 4 },
  topLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  name: { flexShrink: 1 },
  bottomLine: { flexDirection: "row", alignItems: "center", gap: 4 },
  message: { flex: 1 },
  badge: { minWidth: 21, height: 21, paddingHorizontal: 4, borderRadius: 999, backgroundColor: colors.chip, alignItems: "center", justifyContent: "center" },
});
