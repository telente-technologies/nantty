import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { Message } from "@/types";

export interface ChatBubbleProps {
  readonly message: Message;
  readonly isMine: boolean;
}

export function ChatBubble({ message, isMine }: ChatBubbleProps) {
  const isShort = message.text.length <= 24 && !message.text.includes("\n");
  return (
    <View style={[styles.row, isMine ? styles.mine : styles.theirs]}>
      <View
        style={[
          styles.bubble,
          isMine ? styles.bubbleMine : styles.bubbleTheirs,
          isShort ? styles.pill : isMine ? styles.cornerMine : styles.cornerTheirs,
        ]}
      >
        <Text size={13} lineHeight={16.9} color={isMine ? colors.white : colors.text}>
          {message.text}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", paddingHorizontal: 20 },
  mine: { justifyContent: "flex-end" },
  theirs: { justifyContent: "flex-start" },
  bubble: { maxWidth: 260, padding: 12 },
  bubbleMine: { backgroundColor: colors.primary },
  bubbleTheirs: { backgroundColor: colors.skeleton },
  pill: { borderRadius: 999 },
  cornerMine: { borderTopLeftRadius: 12, borderTopRightRadius: 12, borderBottomRightRadius: 0, borderBottomLeftRadius: 12 },
  cornerTheirs: { borderTopLeftRadius: 12, borderTopRightRadius: 12, borderBottomRightRadius: 12, borderBottomLeftRadius: 0 },
});
