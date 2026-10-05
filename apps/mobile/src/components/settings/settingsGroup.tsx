import type { ReactNode } from "react";
import { Children, Fragment } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { ArrowUpRight24Icon, CaretRight24Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { spacing } from "@/constants/spacing.constant";
import { typeScale } from "@/constants/typography.constant";

export function SettingsGroup({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <View style={[styles.group, style]}>
      {rows.map((row, index) => (
        <Fragment key={index}>{row}</Fragment>
      ))}
    </View>
  );
}

export type SettingsRowTrailing = "chevron" | "external" | "none" | { readonly text: string; readonly color?: string; readonly weight?: 400 | 500 };

export interface SettingsRowProps {
  readonly label: string;
  readonly icon?: ReactNode;
  readonly trailing?: SettingsRowTrailing;
  readonly labelColor?: string;
  readonly onPress?: () => void;
  readonly accessibilityHint?: string;
}

export function SettingsRow({ label, icon, trailing = "chevron", labelColor, onPress, accessibilityHint }: SettingsRowProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const trailingValue = typeof trailing === "object" ? trailing : null;
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : "text"}
      accessibilityLabel={trailingValue ? `${label}, ${trailingValue.text}` : label}
      accessibilityHint={accessibilityHint}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.row, icon ? styles.iconRow : styles.plainRow, pressed && styles.pressed]}
    >
      <View style={styles.leading}>
        {icon}
        <Text size={typeScale.md} lineHeight={16.8} color={labelColor ?? colors.text}>
          {label}
        </Text>
      </View>
      {trailing === "chevron" ? <CaretRight24Icon /> : null}
      {trailing === "external" ? <ArrowUpRight24Icon /> : null}
      {trailingValue ? (
        <Text size={typeScale.sm} weight={trailingValue.weight ?? 500} lineHeight={16.9} color={trailingValue.color ?? colors.primary} numberOfLines={1}>
          {trailingValue.text}
        </Text>
      ) : null}
    </Pressable>
  );
}

export function SettingsCenteredAction({ label, color, onPress }: { label: string; color?: string; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.group, styles.centered, pressed && styles.pressed]}>
      <Text size={typeScale.sm} weight={500} lineHeight={16.9} color={color ?? colors.error}>
        {label}
      </Text>
    </Pressable>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  group: { backgroundColor: colors.surface, borderRadius: 12, overflow: "hidden" },
  row: { backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  iconRow: { height: 48, paddingHorizontal: spacing[3] },
  plainRow: { height: 44, paddingHorizontal: spacing[3] },
  leading: { flexDirection: "row", alignItems: "center", gap: spacing[3], flexShrink: 1 },
  centered: { height: 44, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.7 },
}));
