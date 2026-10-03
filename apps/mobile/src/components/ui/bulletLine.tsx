import { StyleSheet, View } from "react-native";

import { Text, type TextProps } from "@/components/ui/text";
import { useTheme } from "@/theme";

export function BulletLine({ children, color, ...textProps }: TextProps) {
  const { colors } = useTheme();
  const ink = color ?? colors.textMuted;
  return (
    <View style={styles.row}>
      <View accessibilityElementsHidden importantForAccessibility="no" style={[styles.dot, { backgroundColor: ink }]} />
      <Text {...textProps} color={ink} style={styles.text}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  dot: { width: 4, height: 4, borderRadius: 2, marginTop: 7 },
  text: { flex: 1 },
});
