import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { FrameAwareModal } from "@/components/ui/frameAwareModal";
import { buildModalElevation, buildModalPalette } from "@/components/ui/modalChrome.constant";

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
        {onReportMessage ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Report message" onPress={onReportMessage} style={styles.reportPill}>
            <Text size={14} weight={600} lineHeight={18} color={buildModalPalette(colors, scheme).destructiveInk}>Report message</Text>
          </Pressable>
        ) : null}
      </Pressable>
    </FrameAwareModal>
  );
}

const useStyles = makeThemedStyles((colors, scheme) => {
  const palette = buildModalPalette(colors, scheme);
  const elevation = buildModalElevation(scheme, palette);
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: palette.scrim, alignItems: "center", justifyContent: "center", gap: 12 },
    bar: { flexDirection: "row", gap: 14, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999, backgroundColor: palette.surface, ...elevation },
    reportPill: { minHeight: 44, justifyContent: "center", paddingHorizontal: 20, borderRadius: 999, backgroundColor: palette.surface, ...elevation },
  });
});
