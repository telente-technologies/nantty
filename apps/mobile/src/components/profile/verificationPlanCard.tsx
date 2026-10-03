import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { VerificationPlan } from "@/types/verification.type";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

import { VERIFICATION_BADGE_COLORS, VerificationBadge } from "./verificationBadge";

const TIER_NAMES: Record<string, string> = { VERIFIED: "Verified", PREMIUM: "Premium", PRO: "Pro", ESSENTIAL: "Essential", OFFICIAL: "Official" };

export function VerificationPlanCard({ plan, selected, current, onPress }: { plan: VerificationPlan; selected?: boolean; current?: boolean; onPress?: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const accent = VERIFICATION_BADGE_COLORS[plan.color];
  return (
    <Pressable
      accessibilityRole={onPress ? "radio" : "text"}
      accessibilityState={{ checked: !!selected }}
      disabled={!onPress}
      onPress={onPress}
      style={[styles.card, selected && { borderColor: accent }]}
    >
      <View style={styles.header}>
        <VerificationBadge verification={{ status: "active", type: plan.color === "blue" ? "personal" : "business", color: plan.color, tier: plan.tier, badgeVisible: true }} size={20} />
        <Text size={15} weight={600} lineHeight={18} style={styles.flex}>{TIER_NAMES[plan.tier] ?? plan.tier}</Text>
        <Text size={14} weight={600} lineHeight={16.8}>{formatMoneyForDisplay(plan.price)} / {plan.interval}</Text>
      </View>
      {current ? <Text size={12} weight={500} lineHeight={14.4} color={accent}>Your current plan</Text> : null}
      {plan.perks.map((perk) => (
        <View key={perk.title} style={styles.perk}>
          <Text size={13} weight={500} lineHeight={16.9}>{perk.title}</Text>
          <Text size={12} lineHeight={16.8} color={colors.textMuted}>{perk.description}</Text>
        </View>
      ))}
    </Pressable>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  flex: { flex: 1 },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, gap: 8, borderWidth: 1.5, borderColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: 8 },
  perk: { gap: 1 },
}));
