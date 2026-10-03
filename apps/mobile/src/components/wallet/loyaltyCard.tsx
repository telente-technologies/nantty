import { StyleSheet, View } from "react-native";

import { Star16Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { palette } from "@/constants/colors.constant";
import { makeThemedStyles, useTheme } from "@/theme";
import type { LoyaltySummary } from "@/types/rewards.type";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

export function LoyaltyCard({ loyalty }: { loyalty: LoyaltySummary }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.titleRow}>
          <Star16Icon color={palette.secondary[700]} />
          <Text size={14} weight={600} lineHeight={16.8}>{loyalty.tierName} member</Text>
        </View>
        <Text size={13} weight={500} lineHeight={16.9} color={colors.primary}>{loyalty.points.toLocaleString()} points</Text>
      </View>
      <View style={styles.row}>
        <Text size={13} lineHeight={16.9} color={colors.textMuted}>Points worth</Text>
        <Text size={13} weight={500} lineHeight={16.9}>{formatMoneyForDisplay(loyalty.pointsValue)}</Text>
      </View>
      <View style={styles.row}>
        <Text size={13} lineHeight={16.9} color={colors.textMuted}>Cashback balance</Text>
        <Text size={13} weight={500} lineHeight={16.9}>{formatMoneyForDisplay(loyalty.cashbackBalance)}</Text>
      </View>
      {loyalty.nextTierName && loyalty.pointsToNextTier ? (
        <Text size={12} lineHeight={16.8} color={colors.textSubtle}>
          {loyalty.pointsToNextTier.toLocaleString()} more points to reach {loyalty.nextTierName}. {loyalty.redeemableAtCheckout ? "You can use points at checkout." : ""}
        </Text>
      ) : null}
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, gap: 8 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
}));
