import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { colors, palette } from "@/constants/colors.constant";
import type { CreatorDashboard } from "@/types/creator.type";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

export function CreatorEarningsCard({ dashboard }: { dashboard: CreatorDashboard }) {
  const breakdown = [
    { label: "Gifts", amount: dashboard.earnings.gifts },
    { label: "Affiliate commissions", amount: dashboard.earnings.affiliateCommissions },
    { label: "Bonuses", amount: dashboard.earnings.bonuses },
  ];
  return (
    <View style={styles.card}>
      <Text size={13} weight={500} lineHeight={16.9} color={colors.textMuted}>Earnings this period</Text>
      <Text size={28} weight={600} lineHeight={33.6}>{formatMoneyForDisplay(dashboard.earnings.total)}</Text>
      <Text size={12} lineHeight={16.8} color={colors.success}>+{dashboard.followersGained.toLocaleString()} new followers</Text>
      <View style={styles.breakdown}>
        {breakdown.map((line) => (
          <View key={line.label} style={styles.row}>
            <Text size={13} lineHeight={16.9} color={colors.textMuted}>{line.label}</Text>
            <Text size={13} weight={500} lineHeight={16.9}>{formatMoneyForDisplay(line.amount)}</Text>
          </View>
        ))}
      </View>
      <View style={styles.balances}>
        <View style={[styles.balance, styles.available]}>
          <Text size={12} lineHeight={14.4} color={palette.primary[100]}>Available</Text>
          <Text size={16} weight={600} lineHeight={19.2} color={colors.white}>{formatMoneyForDisplay(dashboard.availableBalance)}</Text>
        </View>
        <View style={[styles.balance, styles.pending]}>
          <Text size={12} lineHeight={14.4} color={palette.caution[800]}>Pending (escrow)</Text>
          <Text size={16} weight={600} lineHeight={19.2}>{formatMoneyForDisplay(dashboard.pendingBalance)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: 12, padding: 16, gap: 6 },
  breakdown: { marginTop: 8, gap: 6 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  balances: { flexDirection: "row", gap: 8, marginTop: 10 },
  balance: { flex: 1, borderRadius: 10, padding: 12, gap: 4 },
  available: { backgroundColor: colors.primary },
  pending: { backgroundColor: palette.caution[50] },
});
