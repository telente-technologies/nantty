import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import { FrameAwareModal } from "@/components/ui/frameAwareModal";

export const MESSAGE_REACTION_EMOJI = ["❤️", "😂", "🔥", "👍", "😮", "🙏"] as const;

export interface MessageReactionPickerProps {
  readonly visible: boolean;
  readonly onPickEmoji: (emoji: string) => void;
  readonly onClose: () => void;
}

export function MessageReactionPicker({ visible, onPickEmoji, onClose }: MessageReactionPickerProps) {
  return (
    <FrameAwareModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close reactions" style={styles.backdrop} onPress={onClose}>
        <View style={styles.bar} accessibilityRole="menu">
          {MESSAGE_REACTION_EMOJI.map((emoji) => (
            <Pressable
              key={emoji}
              accessibilityRole="menuitem"
              accessibilityLabel={`React with ${emoji}`}
              hitSlop={6}
              onPress={() => onPickEmoji(emoji)}
            >
              <Text size={28} lineHeight={34} letterSpacing={0}>
                {emoji}
              </Text>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </FrameAwareModal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay, alignItems: "center", justifyContent: "center" },
  bar: { flexDirection: "row", gap: 14, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999, backgroundColor: colors.white },
});
