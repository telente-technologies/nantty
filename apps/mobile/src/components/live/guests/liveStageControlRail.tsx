import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";

import { liveAccent, liveGlass } from "../liveSurface.constant";

export interface LiveStageRailButton {
  readonly key: string;
  readonly glyph: ReactNode;
  readonly label: string;
  readonly badgeCount?: number;
  readonly isDisabled?: boolean;
  readonly onPress: () => void;
}

export function LiveStageControlRail({ buttons }: { buttons: readonly LiveStageRailButton[] }) {
  return (
    <View style={styles.rail} pointerEvents="box-none">
      {buttons.map((button) => (
        <Pressable
          key={button.key}
          accessibilityRole="button"
          accessibilityLabel={button.badgeCount ? `${button.label}, ${button.badgeCount} waiting` : button.label}
          accessibilityState={{ disabled: !!button.isDisabled }}
          disabled={button.isDisabled}
          onPress={button.onPress}
          style={({ pressed }) => [styles.button, button.isDisabled ? styles.disabled : null, pressed ? styles.pressed : null]}
        >
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {button.glyph}
          </View>
          <Text size={10} weight={600} lineHeight={12} color={liveGlass.ink} numberOfLines={1}>
            {button.label}
          </Text>
          {button.badgeCount ? (
            <View style={styles.badge}>
              <Text size={10} weight={700} lineHeight={12} color="#FFFFFF">
                {button.badgeCount}
              </Text>
            </View>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: { gap: 8, alignItems: "center" },
  button: { width: 58, paddingVertical: 7, borderRadius: 16, backgroundColor: liveGlass.background, borderWidth: StyleSheet.hairlineWidth, borderColor: liveGlass.border, alignItems: "center", gap: 2 },
  disabled: { opacity: 0.5 },
  pressed: { backgroundColor: liveGlass.backgroundStrong },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: liveAccent.red,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
});
