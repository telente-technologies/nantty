import { type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useMessengerColors } from "./useMessengerColors";

export function ScreenFrame({ title, eyebrow, backgroundColor, children }: { readonly title: string; readonly eyebrow: string; readonly backgroundColor: string; readonly children: ReactNode }) {
  const colors = useMessengerColors();
  return (
    <View style={[styles.root, { backgroundColor }]}>
      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: colors.brand }]}>{eyebrow}</Text>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { minHeight: 82, justifyContent: "center", paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12 },
  eyebrow: { fontSize: 10, lineHeight: 14, fontWeight: "700", letterSpacing: 1.5 },
  title: { fontSize: 27, lineHeight: 34, fontWeight: "700", letterSpacing: -0.6 },
});
