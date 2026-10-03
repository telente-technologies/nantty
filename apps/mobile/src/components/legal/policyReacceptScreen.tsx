import { useState } from "react";
import { Linking, ScrollView, StyleSheet, View } from "react-native";

import { DataExportSection } from "@/components/settings/dataExportSection";
import { DeleteAccountSheet } from "@/components/settings/deleteAccountSheet";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { usePolicyUpdates } from "@/hooks/usePolicyUpdates.hook";
import { makeThemedStyles, useTheme } from "@/theme";
import type { PolicyVersionSummary } from "@/types";

export function PolicyReacceptScreen({ version }: { readonly version: PolicyVersionSummary }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { accept, isAccepting, acceptErrorMessage } = usePolicyUpdates();
  const [isDeleteSheetVisible, setIsDeleteSheetVisible] = useState(false);
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text size={22} weight={600} lineHeight={27} accessibilityRole="header">Please review our updated {version.title}</Text>
        <View style={styles.card}>
          <Text size={14} lineHeight={19.6}>{version.summary}</Text>
          <Text size={12} lineHeight={16.8} color={colors.textMuted}>Version {version.versionLabel}, effective {new Date(version.effectiveAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.</Text>
        </View>
        <Text size={14} color={colors.primary} accessibilityRole="link" onPress={() => Linking.openURL(version.documentUrl)}>Read the full {version.title}</Text>
        <Text size={13} lineHeight={18} color={colors.textMuted}>To keep using Zudomart you need to accept this update.</Text>
        {acceptErrorMessage ? <Text size={12} color={colors.error} accessibilityRole="alert">{acceptErrorMessage}</Text> : null}
        <Button title="Accept and continue" loading={isAccepting} onPress={() => void accept(version)} />
        <View style={styles.alternatives}>
          <Text size={13} lineHeight={18} color={colors.textMuted}>Don't agree? You can take your data and leave.</Text>
          <DataExportSection />
          <Button variant="subtle" title="Delete my account" onPress={() => setIsDeleteSheetVisible(true)} />
        </View>
      </ScrollView>
      <DeleteAccountSheet visible={isDeleteSheetVisible} onClose={() => setIsDeleteSheetVisible(false)} />
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 32, paddingBottom: 40, gap: 18 },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, gap: 6 },
  alternatives: { gap: 12, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
}));
