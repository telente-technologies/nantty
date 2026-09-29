import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { MessageReactionSummary } from "@/types";
import { formatCountWithThousandsSuffix } from "@/utils/formatDate.util";

export interface MessageReactionsRowProps {
  readonly reactions: readonly MessageReactionSummary[];
  readonly onToggleReaction: (emoji: string, shouldReact: boolean) => void;
  readonly alignEnd: boolean;
}

export function MessageReactionsRow({ reactions, onToggleReaction, alignEnd }: MessageReactionsRowProps) {
  if (reactions.length === 0) return null;
  return (
    <View style={[styles.row, alignEnd && styles.alignEnd]}>
      {reactions.map((reaction) => (
        <Pressable
          key={reaction.emoji}
          accessibilityRole="button"
          accessibilityState={{ selected: reaction.reactedByMe }}
          accessibilityLabel={`${reaction.emoji} ${reaction.count}${reaction.reactedByMe ? ", you reacted" : ""}`}
          onPress={() => onToggleReaction(reaction.emoji, !reaction.reactedByMe)}
          style={[styles.chip, reaction.reactedByMe && styles.chipSelected]}
        >
          <Text size={12} lineHeight={14.4} letterSpacing={0}>
            {reaction.emoji} {formatCountWithThousandsSuffix(reaction.count)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 },
  alignEnd: { justifyContent: "flex-end" },
  chip: { height: 24, paddingHorizontal: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.white, justifyContent: "center" },
  chipSelected: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
});
