import * as Clipboard from "expo-clipboard";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { CopyGlyph } from "@/components/icons/errorIcons";
import { useTheme } from "@/theme";

import { Text } from "./text";

export function formatErrorReference(code: string | undefined, reference: string | undefined): string {
  return [reference ? `Ref ${reference}` : null, code ? `Code ${code}` : null].filter(Boolean).join(" · ");
}

export function ErrorReference({ code, reference }: { readonly code?: string; readonly reference?: string }) {
  const { colors } = useTheme();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);
  const text = formatErrorReference(code, reference);
  if (!text) return null;
  return (
    <View style={styles.row}>
      <Text size={12} color={colors.textSubtle} selectable style={styles.text}>
        {text}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copied ? "Reference copied" : "Copy reference for support"}
        hitSlop={8}
        onPress={() => {
          Clipboard.setStringAsync(text).then(() => setCopied(true)).catch(() => undefined);
        }}
        style={[styles.copy, { borderColor: colors.divider }]}
      >
        <CopyGlyph copied={copied} color={colors.textMuted} />
        <Text size={12} weight={500} color={colors.textMuted}>
          {copied ? "Copied" : "Copy"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 8 },
  text: { fontVariant: ["tabular-nums"] },
  copy: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
});
