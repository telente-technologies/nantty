import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { CaretRight24Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";

export interface SettingsLinkRowProps {
  readonly icon: ReactNode;
  readonly label: string;
  readonly value?: string | null;
  readonly hint: string;
  readonly onPress: () => void;
}

export function SettingsLinkRow({ icon, label, value, hint, onPress }: SettingsLinkRowProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      accessibilityHint={hint}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
    >
      {icon}
      <View style={styles.texts}>
        <Text size={14} weight={500} lineHeight={16.8}>{label}</Text>
        {value ? <Text size={12} lineHeight={16.8} color={colors.textMuted} numberOfLines={1}>{value}</Text> : null}
      </View>
      <CaretRight24Icon size={18} />
    </Pressable>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  row: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: colors.divider },
  texts: { flex: 1, gap: 2 },
  pressed: { opacity: 0.6 },
}));
