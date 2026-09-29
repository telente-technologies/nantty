import { Pressable, StyleSheet, View } from "react-native";

import { colors } from "@/constants/colors.constant";

export function RecordButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.outer, (pressed || disabled) && styles.pressed]}
    >
      <View style={styles.inner} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  outer: { width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: colors.primary, alignItems: "center", justifyContent: "center" },
  inner: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.primary },
  pressed: { opacity: 0.7 },
});
