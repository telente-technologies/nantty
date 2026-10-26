import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrandWordmark } from "@/components/auth/brand";
import { BoxArrowDown24Icon, CaretRight24Icon, Check16Icon, Shield24Icon, Trash24Icon } from "@/components/icons";
import { DataExportSection } from "@/components/settings/dataExportSection";
import { DeleteAccountSheet } from "@/components/settings/deleteAccountSheet";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { ModalActionButton } from "@/components/ui/modalActions";
import { buildModalPalette, buildModalToneColors, modalRadius } from "@/components/ui/modalChrome.constant";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { usePolicyUpdates } from "@/hooks/usePolicyUpdates.hook";
import { makeThemedStyles, useTheme } from "@/theme";
import type { PolicyVersionSummary } from "@/types";

import { PolicyDocumentCard } from "./policyDocumentCard";
import { joinPolicyTitles } from "./policyHighlights.util";

const LARGE_TEXT_MULTIPLIER = 2;

function ChoiceRow({ icon, label, detail, onPress }: { readonly icon: ReactNode; readonly label: string; readonly detail: string; readonly onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityHint={detail} onPress={onPress} style={({ pressed }) => [styles.choiceRow, pressed ? styles.choicePressed : null]}>
      <View style={styles.choiceIcon}>{icon}</View>
      <View style={styles.choiceText}>
        <Text size={14} weight={500} lineHeight={19} maxFontSizeMultiplier={LARGE_TEXT_MULTIPLIER}>{label}</Text>
        <Text size={12} lineHeight={17} color={colors.textMuted} maxFontSizeMultiplier={LARGE_TEXT_MULTIPLIER}>{detail}</Text>
      </View>
      <CaretRight24Icon size={18} color={colors.textMuted} />
    </Pressable>
  );
}

export function PolicyReacceptScreen({ version }: { readonly version: PolicyVersionSummary }) {
  const { colors, scheme } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { pending, acceptAllPending, isAccepting, acceptErrorMessage } = usePolicyUpdates();
  const [hasAgreed, setHasAgreed] = useState(false);
  const [isDeleteSheetVisible, setIsDeleteSheetVisible] = useState(false);
  const [isExportSheetVisible, setIsExportSheetVisible] = useState(false);
  const versions = pending.length > 0 ? pending : [version];
  const brand = buildModalToneColors(colors, scheme, "brand");
  const documentNames = joinPolicyTitles(versions);
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.brandRow}>
          <BrandWordmark />
        </View>
        <View style={[styles.illustration, { backgroundColor: brand.tint }]}>
          <Shield24Icon size={30} color={brand.ink} />
        </View>
        <Text size={24} weight={600} lineHeight={30} align="center" accessibilityRole="header" maxFontSizeMultiplier={LARGE_TEXT_MULTIPLIER}>
          We've updated our {documentNames}
        </Text>
        <Text size={15} lineHeight={22} align="center" color={colors.textMuted} maxFontSizeMultiplier={LARGE_TEXT_MULTIPLIER}>
          Here's a short summary of what changed. Please read it, then accept the update to keep using Nantty. Your account, orders and messages are safe either way.
        </Text>
        <View style={styles.cards}>
          {versions.map((pendingVersion) => (
            <PolicyDocumentCard key={pendingVersion.policyVersionId} version={pendingVersion} />
          ))}
        </View>
        <Text size={13} weight={600} lineHeight={18} color={colors.textMuted} maxFontSizeMultiplier={LARGE_TEXT_MULTIPLIER} style={styles.choicesHeading}>
          Not ready to agree?
        </Text>
        <View style={styles.choices}>
          <ChoiceRow icon={<BoxArrowDown24Icon size={20} color={colors.text} />} label="Download my data" detail="Get a copy of everything we hold about you" onPress={() => setIsExportSheetVisible(true)} />
          <View style={styles.choiceDivider} />
          <ChoiceRow icon={<Trash24Icon size={20} color={colors.text} />} label="Delete my account" detail="See what's deleted and what the law requires us to keep" onPress={() => setIsDeleteSheetVisible(true)} />
        </View>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: hasAgreed }}
          onPress={() => setHasAgreed((agreed) => !agreed)}
          style={styles.agreeRow}
        >
          <View style={[styles.checkbox, hasAgreed ? styles.checkboxChecked : null]}>
            {hasAgreed ? <Check16Icon size={14} color={colors.onPrimary} /> : null}
          </View>
          <Text size={14} lineHeight={20} style={styles.agreeText} maxFontSizeMultiplier={LARGE_TEXT_MULTIPLIER}>
            I have read and agree to the updated Terms and Privacy Policy
          </Text>
        </Pressable>
        {acceptErrorMessage ? (
          <Text size={13} lineHeight={18} color={colors.error} accessibilityRole="alert">
            {acceptErrorMessage}
          </Text>
        ) : null}
        <ModalActionButton
          action={{
            label: "Accept and continue",
            style: "primary",
            disabled: !hasAgreed,
            loading: isAccepting,
            accessibilityHint: hasAgreed ? undefined : "Tick the box above first",
            onPress: () => void acceptAllPending().catch(() => undefined),
          }}
        />
      </View>
      <BottomSheet visible={isExportSheetVisible} onClose={() => setIsExportSheetVisible(false)} title="Download my data" scrollable>
        <DataExportSection />
      </BottomSheet>
      <DeleteAccountSheet visible={isDeleteSheetVisible} onClose={() => setIsDeleteSheetVisible(false)} />
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors, scheme) => {
  const palette = buildModalPalette(colors, scheme);
  return StyleSheet.create({
    content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32, gap: 14, maxWidth: 560, width: "100%", alignSelf: "center" },
    brandRow: { alignItems: "center", marginBottom: 12 },
    illustration: { alignSelf: "center", width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", marginBottom: 4 },
    cards: { gap: 12, marginTop: 8 },
    choicesHeading: { marginTop: 12 },
    choices: { borderRadius: modalRadius.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.divider, backgroundColor: palette.surface, overflow: "hidden" },
    choiceRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 14, minHeight: 56 },
    choicePressed: { backgroundColor: palette.secondaryPressed },
    choiceIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: palette.inset },
    choiceText: { flex: 1, gap: 2 },
    choiceDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginLeft: 62 },
    footer: { paddingHorizontal: 20, paddingTop: 14, gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider, backgroundColor: colors.background },
    agreeRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, minHeight: 44, paddingVertical: 4 },
    checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: scheme === "dark" ? "#8E8E92" : "#80869F", alignItems: "center", justifyContent: "center", marginTop: 0 },
    checkboxChecked: { backgroundColor: colors.primarySolid, borderColor: colors.primarySolid },
    agreeText: { flex: 1 },
  });
});
