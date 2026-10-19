import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { makeThemedStyles, type ThemeColors } from "@/theme";
import { radius } from "@/constants/spacing.constant";

import { Text } from "./text";

export type ButtonVariant = "primary" | "outline" | "brand" | "neutral" | "subtle" | "danger";

export interface ButtonProps {
  readonly title: string;
  readonly onPress?: () => void;
  readonly variant?: ButtonVariant;
  readonly disabled?: boolean;
  readonly loading?: boolean;
  readonly icon?: ReactNode;
  readonly iconGap?: number;
  readonly height?: number;
  readonly style?: StyleProp<ViewStyle>;
  readonly accessibilityLabel?: string;
}

export function Button({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  icon,
  iconGap,
  height = 44,
  style,
  accessibilityLabel,
}: ButtonProps) {
  const { looks, disabledLook } = useButtonLooks();
  const inactive = disabled || loading;
  const look = inactive && (variant === "primary" || variant === "brand") ? disabledLook : looks[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [styles.base, { height }, look.container, pressed && !inactive && styles.pressed, style]}
    >
      {loading ? (
        <ActivityIndicator color={look.textColor} />
      ) : (
        <View style={[styles.row, { gap: icon ? iconGap ?? look.gap : 0 }]}>
          {icon}
          <Text size={look.size} weight={look.weight} lineHeight={look.lineHeight} color={look.textColor}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

interface Look {
  readonly container: ViewStyle;
  readonly textColor: string;
  readonly size: number;
  readonly weight: 400 | 500;
  readonly lineHeight: number;
  readonly gap: number;
}

const buildButtonLooks = (colors: ThemeColors): Record<ButtonVariant, Look> => ({
  primary: { container: { backgroundColor: colors.primarySolid }, textColor: colors.onPrimary, size: 15, weight: 500, lineHeight: 21, gap: 10 },
  brand: { container: { backgroundColor: colors.primarySolid }, textColor: colors.onPrimary, size: 14, weight: 400, lineHeight: 16.8, gap: 12 },
  outline: {
    container: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.text },
    textColor: colors.text,
    size: 14,
    weight: 400,
    lineHeight: 16.8,
    gap: 8,
  },
  neutral: { container: { backgroundColor: colors.chip }, textColor: colors.text, size: 14, weight: 400, lineHeight: 16.8, gap: 8 },
  subtle: {
    container: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider },
    textColor: colors.text,
    size: 14,
    weight: 400,
    lineHeight: 16.8,
    gap: 8,
  },
  danger: { container: { backgroundColor: colors.surface }, textColor: colors.error, size: 13, weight: 400, lineHeight: 16.9, gap: 8 },
});

const useButtonLooks = makeThemedStyles((colors) => {
  const looks = buildButtonLooks(colors);
  return { looks, disabledLook: { ...looks.primary, container: { backgroundColor: colors.disabled }, textColor: colors.disabledText } as Look };
});

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  row: { flexDirection: "row", alignItems: "center" },
  pressed: { opacity: 0.85 },
});
