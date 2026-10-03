import { useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Cancel20Icon } from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { usePolicyUpdates } from "@/hooks/usePolicyUpdates.hook";
import { usePolicyUpdateStore } from "@/store/policyUpdate.store";
import { makeThemedStyles, useTheme } from "@/theme";
import type { PolicyVersionSummary } from "@/types";

function formatEffectiveDate(isoText: string): string {
  return new Date(isoText).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function SummarySheet({ version, onClose }: { readonly version: PolicyVersionSummary; readonly onClose: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { accept, isAccepting, acceptErrorMessage } = usePolicyUpdates();
  return (
    <BottomSheet visible onClose={onClose} title={`${version.title} updated`}>
      <View style={styles.sheetBody}>
        <Text size={13} color={colors.textMuted}>Version {version.versionLabel}, effective {formatEffectiveDate(version.effectiveAt)}</Text>
        <Text size={14} lineHeight={19.6}>{version.summary}</Text>
        {version.isMaterialChange ? <Text size={13} lineHeight={18} color={colors.textMuted}>This is a material change. Please accept it by {formatEffectiveDate(version.effectiveAt)} to keep using Zudomart.</Text> : null}
        <Text size={14} color={colors.primary} accessibilityRole="link" onPress={() => Linking.openURL(version.documentUrl)}>Read the full {version.title}</Text>
        {acceptErrorMessage ? <Text size={12} color={colors.error} accessibilityRole="alert">{acceptErrorMessage}</Text> : null}
        <Button title={version.isMaterialChange ? "Accept update" : "Got it"} loading={isAccepting} onPress={async () => { await accept(version); onClose(); }} />
      </View>
    </BottomSheet>
  );
}

export function PolicyUpdateBanner() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { isSignedIn, bannerVersions } = usePolicyUpdates();
  const dismissPolicyBanner = usePolicyUpdateStore((state) => state.dismissPolicyBanner);
  const [openedVersionId, setOpenedVersionId] = useState<string | null>(null);
  const opened = bannerVersions.find((version) => version.policyVersionId === openedVersionId) ?? null;
  const first = bannerVersions[0];
  if (!isSignedIn || !first) return null;
  return (
    <>
      <View style={[styles.banner, { paddingTop: insets.top + 8 }]} accessibilityRole="alert">
        <Pressable style={styles.message} accessibilityRole="button" onPress={() => setOpenedVersionId(first.policyVersionId)}>
          <Text size={13} weight={600} lineHeight={17}>We've updated our {bannerVersions.map((version) => version.title).join(" and ")}</Text>
          <Text size={12} color={colors.primary}>See what changed</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss this notice" hitSlop={10} onPress={() => dismissPolicyBanner(bannerVersions.map((version) => version.policyVersionId))}>
          <Cancel20Icon />
        </Pressable>
      </View>
      {opened ? <SummarySheet version={opened} onClose={() => setOpenedVersionId(null)} /> : null}
    </>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  banner: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 50, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 10, backgroundColor: colors.primaryTint, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  message: { flex: 1, gap: 2 },
  sheetBody: { gap: 12, paddingBottom: 8 },
}));
