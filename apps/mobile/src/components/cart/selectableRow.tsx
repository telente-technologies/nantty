import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { colors } from "@/constants/colors.constant";

export interface SelectableRowProps {
  readonly selected: boolean;
  readonly onPress: () => void;
  readonly accessibilityLabel: string;
  readonly children: ReactNode;
}

export function SelectableRow({ selected, onPress, accessibilityLabel, children }: SelectableRowProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[styles.row, selected && styles.selected]}
    >
      <View style={styles.body}>{children}</View>
      <View style={[styles.radio, selected && styles.radioSelected]}>{selected ? <View style={styles.dot} /> : null}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.white,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  selected: { borderColor: colors.primary },
  body: { flex: 1, gap: 4 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: colors.textSubtle, alignItems: "center", justifyContent: "center" },
  radioSelected: { borderColor: colors.primary },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
});
