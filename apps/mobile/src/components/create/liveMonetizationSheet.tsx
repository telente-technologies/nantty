import { Pressable, StyleSheet, Switch, View } from "react-native";

import { Minus16Icon, Plus16Icon } from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { Chip } from "@/components/ui/chip";
import { TextField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { LiveAdPlacement } from "@/types/socialGraph.type";

import {
  LIVE_AD_MAX_INTERRUPTIONS,
  LIVE_AD_MIN_INTERVAL_OPTIONS_MINUTES,
  LIVE_AD_PLACEMENT_OPTIONS,
  LIVE_AD_TERMS_SUMMARY,
  LIVE_AD_TERMS_VERSION,
  type LiveMonetizationDraft,
} from "./liveMonetization.constant";
import { BulletLine } from "@/components/ui/bulletLine";

export interface LiveMonetizationSheetProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly draft: LiveMonetizationDraft;
  readonly onChangeDraft: (draft: LiveMonetizationDraft) => void;
}

function SwitchRow({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (value: boolean) => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.switchRow}>
      <View style={styles.flex}>
        <Text size={14} weight={500} lineHeight={16.8}>{label}</Text>
        {hint ? <Text size={12} lineHeight={16.8} color={colors.textMuted}>{hint}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={label} trackColor={{ true: colors.primary, false: colors.divider }} />
    </View>
  );
}

export function LiveMonetizationSheet({ visible, onClose, draft, onChangeDraft }: LiveMonetizationSheetProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const togglePlacement = (placement: LiveAdPlacement) =>
    onChangeDraft({
      ...draft,
      placements: draft.placements.includes(placement) ? draft.placements.filter((item) => item !== placement) : [...draft.placements, placement],
    });
  const changeMaxInterruptions = (delta: number) =>
    onChangeDraft({ ...draft, maxInterruptions: Math.min(LIVE_AD_MAX_INTERRUPTIONS, Math.max(0, draft.maxInterruptions + delta)) });

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Live monetization" subtitle="Ads stay off unless you opt in" scrollable footerActions={[{ label: "Done", style: "primary", onPress: onClose }]}>
      <View style={styles.body}>
        <SwitchRow
          label="Allow ZudoMart ads"
          hint="Off by default. Ads only run if you opt in and agree to the live-ad terms."
          value={draft.allowAds}
          onChange={(allowAds) => onChangeDraft({ ...draft, allowAds })}
        />
        {draft.allowAds ? (
          <>
            <View style={styles.terms}>
              <Text size={13} weight={600} lineHeight={17}>Live-ad terms</Text>
              {LIVE_AD_TERMS_SUMMARY.map((line) => (
                <BulletLine key={line} size={12} lineHeight={16.8} color={colors.text}>{line}</BulletLine>
              ))}
              <SwitchRow
                label={`I agree to the live-ad terms (${LIVE_AD_TERMS_VERSION})`}
                value={draft.agreedToTerms}
                onChange={(agreedToTerms) => onChangeDraft({ ...draft, agreedToTerms })}
              />
              {draft.agreedToTerms ? null : (
                <Text size={12} lineHeight={16.8} color={colors.error} accessibilityLiveRegion="polite">Ads stay off until you agree.</Text>
              )}
            </View>
            <Text size={14} weight={500} lineHeight={16.8}>Placements</Text>
            <View style={styles.chips}>
              {LIVE_AD_PLACEMENT_OPTIONS.map((option) => (
                <Chip key={option.key} kind="filter" label={option.label} selected={draft.placements.includes(option.key)} onPress={() => togglePlacement(option.key)} />
              ))}
            </View>
            <View style={styles.stepper}>
              <Text size={14} weight={500} lineHeight={16.8} style={styles.flex}>Max interruptions: {draft.maxInterruptions}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Fewer interruptions" hitSlop={8} onPress={() => changeMaxInterruptions(-1)} style={styles.stepButton}>
                <Minus16Icon color={colors.text} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="More interruptions" hitSlop={8} onPress={() => changeMaxInterruptions(1)} style={styles.stepButton}>
                <Plus16Icon color={colors.text} />
              </Pressable>
            </View>
            <Text size={14} weight={500} lineHeight={16.8}>Minimum interval</Text>
            <View style={styles.chips}>
              {LIVE_AD_MIN_INTERVAL_OPTIONS_MINUTES.map((minutes) => (
                <Chip key={minutes} kind="filter" label={`${minutes} min`} selected={draft.minIntervalMinutes === minutes} onPress={() => onChangeDraft({ ...draft, minIntervalMinutes: minutes })} />
              ))}
            </View>
            <SwitchRow label="Show ad indicator" value={draft.showAdIndicator} onChange={(showAdIndicator) => onChangeDraft({ ...draft, showAdIndicator })} />
          </>
        ) : null}
        <TextField
          label="Your own sponsorship (optional)"
          placeholder="Sponsored by..."
          value={draft.sponsorshipLine}
          onChangeText={(sponsorshipLine) => onChangeDraft({ ...draft, sponsorshipLine })}
          maxLength={80}
        />
        <Text size={12} lineHeight={16} color={colors.textMuted}>Your own sponsors are your business. ZudoMart does not sell or take a share of them.</Text>
      </View>
    </BottomSheet>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  flex: { flex: 1 },
  body: { paddingTop: 4, gap: 14 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  terms: { gap: 8, padding: 14, borderRadius: 14, backgroundColor: colors.background },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepButton: { width: 32, height: 25, borderRadius: 4, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
}));
