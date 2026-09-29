import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { LocalMessageDeliveryStatus } from "@/cache/messageHistory.type";
import type { Message } from "@/types";

export interface ChatBubbleProps {
  readonly message: Message;
  readonly isMine: boolean;
  readonly deliveryStatus?: LocalMessageDeliveryStatus;
}

export function ChatBubble({
  message,
  isMine,
  deliveryStatus = "sent",
}: ChatBubbleProps) {
  const isShort = message.text.length <= 24 && !message.text.includes("\n");
  return (
    <View style={[styles.row, isMine ? styles.mine : styles.theirs]}>
      <View style={isMine ? styles.mineColumn : undefined}>
        <View
          accessibilityLabel={
            deliveryStatus === "pending"
              ? `${message.text}, sending`
              : undefined
          }
          style={[
            styles.bubble,
            deliveryStatus === "pending" && styles.pendingBubble,
            isMine ? styles.bubbleMine : styles.bubbleTheirs,
            isShort
              ? styles.pill
              : isMine
                ? styles.cornerMine
                : styles.cornerTheirs,
          ]}
        >
          <Text
            size={13}
            lineHeight={16.9}
            color={isMine ? colors.white : colors.text}
          >
            {message.text}
          </Text>
        </View>
        {deliveryStatus === "failed" ? (
          <Text size={11} lineHeight={15.4} color={colors.error} align="right">
            Not sent
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", paddingHorizontal: 20 },
  mine: { justifyContent: "flex-end" },
  theirs: { justifyContent: "flex-start" },
  mineColumn: { alignItems: "flex-end", gap: 2 },
  bubble: { maxWidth: 260, padding: 12 },
  pendingBubble: { opacity: 0.6 },
  bubbleMine: { backgroundColor: colors.primary },
  bubbleTheirs: { backgroundColor: colors.skeleton },
  pill: { borderRadius: 999 },
  cornerMine: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 0,
    borderBottomLeftRadius: 12,
  },
  cornerTheirs: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    borderBottomLeftRadius: 0,
  },
});
