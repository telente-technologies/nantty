import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";

export interface LiveStageRailButton {
  readonly key: string;
  readonly glyph: string;
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
          style={[styles.button, button.isDisabled ? styles.disabled : null]}
        >
          <Text size={18} lineHeight={22}>
            {button.glyph}
          </Text>
          <Text size={10} weight={600} lineHeight={12} color={colors.white} numberOfLines={1}>
            {button.label}
          </Text>
          {button.badgeCount ? (
            <View style={styles.badge}>
              <Text size={10} weight={700} lineHeight={12} color={colors.white}>
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
  rail: { gap: 10, alignItems: "center" },
  button: { width: 56, paddingVertical: 6, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", gap: 2 },
  disabled: { opacity: 0.5 },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.live,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
});
