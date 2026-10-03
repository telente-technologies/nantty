import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";

import { useLiveForeground } from "./liveSurface.constant";

export const LIVE_REACTION_EMOJI = ["😂", "😍", "😊", "🥰", "😆", "😎"] as const;

export interface LiveReactionRailProps {
  readonly expanded: boolean;
  readonly onReact: (emoji: string) => void;
  readonly isShownOverVideo?: boolean;
}

export function LiveReactionRail({ expanded, onReact, isShownOverVideo = true }: LiveReactionRailProps) {
  const foreground = useLiveForeground(isShownOverVideo);
  const emoji = expanded ? LIVE_REACTION_EMOJI : LIVE_REACTION_EMOJI.slice(-1);
  return (
    <View style={[styles.rail, expanded ? [styles.expandedRail, { backgroundColor: foreground.chip, borderColor: foreground.chipBorder }] : null]}>
      {emoji.map((e) => (
        <Pressable key={e} accessibilityRole="button" accessibilityLabel={`React with ${e}`} hitSlop={4} onPress={() => onReact(e)} style={({ pressed }) => [styles.reaction, pressed ? styles.pressed : null]}>
          <Text size={24} lineHeight={28.8} letterSpacing={-0.5}>
            {e}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: { width: 40, gap: 6, alignItems: "center" },
  expandedRail: { paddingVertical: 6, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  reaction: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 18 },
  pressed: { transform: [{ scale: 1.15 }] },
});
