import { Pressable, StyleSheet, View } from "react-native";

import { BottomSheet } from "@/components/ui/bottomSheet";
import { buildModalPalette } from "@/components/ui/modalChrome.constant";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";

export const MESSAGE_REACTION_EMOJI = ["❤️", "😂", "🔥", "👍", "😮", "🙏"] as const;

export interface MessageReactionPickerProps {
  readonly visible: boolean;
  readonly onPickEmoji: (emoji: string) => void;
  readonly onClose: () => void;
  readonly onReportMessage?: () => void;
}

export function MessageReactionPicker({ visible, onPickEmoji, onClose, onReportMessage }: MessageReactionPickerProps) {
  const styles = useStyles();
  const { colors, scheme } = useTheme();
  return (
    <BottomSheet visible={visible} onClose={onClose} title="React to message">
      <View style={styles.body}>
        <View style={styles.bar} accessibilityRole="menu">
          {MESSAGE_REACTION_EMOJI.map((emoji) => (
            <Pressable
              key={emoji}
              accessibilityRole="menuitem"
              accessibilityLabel={`React with ${emoji}`}
              onPress={() => onPickEmoji(emoji)}
              style={({ pressed }) => [styles.emoji, pressed ? styles.emojiPressed : null]}
            >
              <Text size={28} lineHeight={34} letterSpacing={0}>
                {emoji}
              </Text>
            </Pressable>
          ))}
        </View>
        {onReportMessage ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Report message" onPress={onReportMessage} style={({ pressed }) => [styles.reportRow, pressed ? styles.emojiPressed : null]}>
            <Text size={15} weight={600} lineHeight={20} color={buildModalPalette(colors, scheme).destructiveInk}>
              Report message
            </Text>
          </Pressable>
        ) : null}
      </View>
    </BottomSheet>
  );
}

const useStyles = makeThemedStyles((colors, scheme) => {
  const palette = buildModalPalette(colors, scheme);
  return StyleSheet.create({
    body: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
    bar: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
    emoji: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 24 },
    emojiPressed: { backgroundColor: palette.inset },
    reportRow: { minHeight: 48, justifyContent: "center", paddingHorizontal: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
  });
});
