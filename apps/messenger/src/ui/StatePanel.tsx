import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Icon } from "phosphor-react-native";

import { useMessengerColors } from "./useMessengerColors";

export function StatePanel({
  Icon: Glyph,
  title,
  description,
  actionLabel,
  onAction,
  tone = "default",
}: {
  readonly Icon: Icon;
  readonly title: string;
  readonly description: string;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
  readonly tone?: "default" | "error";
}) {
  const colors = useMessengerColors();
  const tint = tone === "error" ? colors.danger : colors.brand;
  return (
    <View style={styles.panel}>
      <View style={[styles.iconCircle, { backgroundColor: colors.brandTint }]}>
        <Glyph size={26} color={tint} weight="regular" />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.description, { color: colors.muted }]}>{description}</Text>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} style={({ pressed }) => [styles.action, { backgroundColor: colors.brand }, pressed && styles.pressed]}>
          <Text style={[styles.actionText, { color: colors.onBrand }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  iconCircle: { width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  title: { fontSize: 17, lineHeight: 23, fontWeight: "700", textAlign: "center" },
  description: { maxWidth: 340, fontSize: 14, lineHeight: 21, textAlign: "center" },
  action: { minHeight: 44, minWidth: 124, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, marginTop: 8 },
  actionText: { fontSize: 14, fontWeight: "700" },
  pressed: { opacity: 0.82 },
});
