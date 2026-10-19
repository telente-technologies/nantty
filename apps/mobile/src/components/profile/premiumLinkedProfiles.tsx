import { Pressable, StyleSheet, View } from "react-native";

import { StatusPill } from "@/components/escrow/statusPill";
import { SettingsGroup, SettingsRow } from "@/components/settings/settingsGroup";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { LinkedProfileItem, LinkedProfiles } from "@/types/brand.type";
import {
  BUSINESS_PROFILE_LIMIT_REACHED, businessProfileCreationState, describeBusinessProfileAllowance, describePremiumNeeded, linkedProfileBadges, PREMIUM_NEEDED_LABEL,
} from "@/utils/businessProfileAllowance.util";
import { LINKED_KIND_LABELS } from "@/utils/linkedProfiles.util";

import { BluePremiumProfilesUpsell } from "./bluePremiumProfilesUpsell";

export interface PremiumLinkedProfilesProps {
  readonly linked: LinkedProfiles;
  readonly onOpenProfile: (item: LinkedProfileItem) => void;
  readonly onOpenStore: () => void;
  readonly onCreateBusiness: () => void;
  readonly onCreateBrand: () => void;
}

export function PremiumLinkedProfiles({ linked, onOpenProfile, onOpenStore, onCreateBusiness, onCreateBrand }: PremiumLinkedProfilesProps) {
  const { colors } = useTheme();
  const allowance = linked.businessProfiles;
  const premiumNeeded = describePremiumNeeded(allowance);
  const profiles = linked.items.filter((item) => item.status !== "retired");
  const creation = businessProfileCreationState(linked);
  return (
    <>
      <View style={sectionStyles.section}>
        <Text size={14} weight={500}>{describeBusinessProfileAllowance(allowance)}</Text>
        <Text size={13} lineHeight={18} color={colors.textMuted}>
          Blue Premium lets you run up to {allowance.premiumLimit} business profiles. Only one of them can be a store; the others are Business pages or Brands.
        </Text>
        {premiumNeeded ? <Text size={13} weight={500} lineHeight={18} color={colors.error}>{premiumNeeded}</Text> : null}
        {premiumNeeded ? <Text size={12} lineHeight={16} color={colors.textMuted}>Your profiles keep working and nothing is deleted. You can't add new ones until Premium is back.</Text> : null}
      </View>
      <View style={sectionStyles.section}>
        <Text size={14} weight={500}>Your business profiles</Text>
        {profiles.map((item) => <LinkedProfileRow key={item.profileId} item={item} onPress={() => onOpenProfile(item)} />)}
      </View>
      {creation === "open" ? (
        <View style={sectionStyles.section}>
          <Text size={14} weight={500}>Add a profile</Text>
          <SettingsGroup>
            {linked.canCreate.store ? <SettingsRow label="Open a store" trailing={{ text: "Sell in Mart" }} onPress={onOpenStore} /> : null}
            {linked.canCreate.business ? <SettingsRow label="Create a Business page" trailing={{ text: "No shop" }} onPress={onCreateBusiness} /> : null}
            {linked.canCreate.brand ? <SettingsRow label="Create a brand" onPress={onCreateBrand} /> : null}
          </SettingsGroup>
        </View>
      ) : creation === "premiumLimitReached" ? (
        <Text size={13} lineHeight={18} color={colors.textMuted}>{BUSINESS_PROFILE_LIMIT_REACHED}.</Text>
      ) : (
        <BluePremiumProfilesUpsell note={premiumNeeded} />
      )}
    </>
  );
}

function LinkedProfileRow({ item, onPress }: { readonly item: LinkedProfileItem; readonly onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const badges = linkedProfileBadges(item);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={[item.name, LINKED_KIND_LABELS[item.kind], ...badges].join(", ")} onPress={onPress} style={styles.row}>
      <View style={sectionStyles.texts}>
        <Text size={14} weight={500}>{item.name || "Pending review"}</Text>
        <Text size={12} color={colors.textMuted}>{LINKED_KIND_LABELS[item.kind]}{item.handle ? ` · @${item.handle}` : ""}{item.status === "held" ? " · On hold" : ""}</Text>
      </View>
      <View style={styles.badges}>
        {badges.map((label) => <StatusPill key={label} label={label} tone={label === PREMIUM_NEEDED_LABEL ? "caution" : "neutral"} />)}
      </View>
    </Pressable>
  );
}

const sectionStyles = StyleSheet.create({
  section: { gap: 8 },
  texts: { flex: 1, gap: 2 },
});

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.divider },
  badges: { flexDirection: "row", gap: 6 },
}));
