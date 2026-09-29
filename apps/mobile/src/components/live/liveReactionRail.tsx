import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";

export const LIVE_REACTION_EMOJI = ["😂", "😍", "😊", "🥰", "😆", "😎"] as const;

export interface LiveReactionRailProps {
  readonly expanded: boolean;
  readonly onReact: (emoji: string) => void;
}

export function LiveReactionRail({ expanded, onReact }: LiveReactionRailProps) {
  const emoji = expanded ? LIVE_REACTION_EMOJI : LIVE_REACTION_EMOJI.slice(-1);
  return (
    <View style={[styles.rail, expanded ? styles.expandedRail : null]}>
      {emoji.map((e) => (
        <Pressable key={e} accessibilityRole="button" accessibilityLabel={`React with ${e}`} onPress={() => onReact(e)}>
          <Text size={24} lineHeight={28.8} letterSpacing={-0.5}>
            {e}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: { width: 24, gap: 12 },
  expandedRail: { width: 40, padding: 8, marginRight: -8, borderRadius: 99, backgroundColor: colors.placeholder },
});
