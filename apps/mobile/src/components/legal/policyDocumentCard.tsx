import { Pressable, StyleSheet, View } from "react-native";

import { ArrowUpRight24Icon, Document24Icon } from "@/components/icons";
import { buildModalPalette, buildModalToneColors, modalRadius } from "@/components/ui/modalChrome.constant";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { PolicyVersionSummary } from "@/types";

import { formatPolicyEffectiveDate, hasPolicyTakenEffect, listPolicyHighlights, openPolicyDocumentInApp } from "./policyHighlights.util";

const LARGE_TEXT_MULTIPLIER = 2;

export function PolicyDocumentCard({ version }: { readonly version: PolicyVersionSummary }) {
  const styles = useStyles();
  const { colors, scheme } = useTheme();
  const palette = buildModalPalette(colors, scheme);
  const brand = buildModalToneColors(colors, scheme, "brand");
  const caution = buildModalToneColors(colors, scheme, "caution");
  const effectiveLabel = `${hasPolicyTakenEffect(version) ? "Effective since" : "Effective"} ${formatPolicyEffectiveDate(version.effectiveAt)}`;
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={[styles.documentIcon, { backgroundColor: brand.tint }]}>
          <Document24Icon size={20} color={brand.ink} />
        </View>
        <View style={styles.headerText}>
          <Text size={15} weight={600} lineHeight={20} maxFontSizeMultiplier={LARGE_TEXT_MULTIPLIER}>{version.title}</Text>
          <Text size={13} lineHeight={18} color={colors.textMuted} maxFontSizeMultiplier={LARGE_TEXT_MULTIPLIER}>
            Version {version.versionLabel} · {effectiveLabel}
          </Text>
        </View>
      </View>
      {version.isMaterialChange ? (
        <View style={[styles.chip, { backgroundColor: caution.tint }]}>
          <Text size={12} weight={600} lineHeight={16} color={caution.ink} maxFontSizeMultiplier={LARGE_TEXT_MULTIPLIER}>Important change</Text>
        </View>
      ) : null}
      <View style={styles.divider} />
      <Text size={12} weight={600} lineHeight={16} color={colors.textMuted} letterSpacing={0.4} maxFontSizeMultiplier={LARGE_TEXT_MULTIPLIER}>
        WHAT CHANGED
      </Text>
      <View style={styles.list} accessibilityRole="list">
        {listPolicyHighlights(version).map((highlight) => (
          <View key={highlight} style={styles.listRow}>
            <View style={[styles.bullet, { backgroundColor: brand.ink }]} />
            <Text size={14} lineHeight={20} style={styles.listText} maxFontSizeMultiplier={LARGE_TEXT_MULTIPLIER}>{highlight}</Text>
          </View>
        ))}
      </View>
      <Pressable
        accessibilityRole="link"
        accessibilityHint="Opens in the in-app browser"
        onPress={() => void openPolicyDocumentInApp(version.documentUrl)}
        style={({ pressed }) => [styles.readLink, pressed ? { opacity: 0.7 } : null]}
        hitSlop={14}
      >
        <Text size={14} weight={600} lineHeight={20} color={palette.link} maxFontSizeMultiplier={LARGE_TEXT_MULTIPLIER}>Read full {version.title}</Text>
        <ArrowUpRight24Icon size={16} color={palette.link} />
      </Pressable>
    </View>
  );
}

const useStyles = makeThemedStyles((colors, scheme) => {
  const palette = buildModalPalette(colors, scheme);
  return StyleSheet.create({
    card: { backgroundColor: palette.inset, borderRadius: modalRadius.card, padding: 16, gap: 10 },
    headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    documentIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    headerText: { flex: 1, gap: 2 },
    chip: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: modalRadius.chip },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginVertical: 2 },
    list: { gap: 8 },
    listRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
    bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
    listText: { flex: 1 },
    readLink: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingVertical: 4 },
  });
});
