import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { makeThemedStyles } from "@/theme";
import type { CreatorRevenueRules } from "@/types/creator.type";
import { BulletLine } from "@/components/ui/bulletLine";

export function RevenueRulesCard({ rules }: { rules: CreatorRevenueRules }) {
  const styles = useStyles();
  const lines = [
    `Gifts from lives: you keep up to ${rules.giftCreatorSharePercentUpTo}%.`,
    `Ads shown on your content: ${rules.adsRevenueCreatorSharePercent}% revenue share to you.`,
    `Coin transfers carry a ${rules.coinTransferPlatformFeePercent}% platform fee.`,
    rules.affiliateCommissionReleasedAfterEscrow
      ? "Affiliate commissions become available once the buyer's escrow is released."
      : "Affiliate commissions are available right away.",
    rules.withdrawalFeeDescription,
  ];
  return (
    <View style={styles.card}>
      <Text size={16} weight={600} lineHeight={19.2}>How you earn</Text>
      {lines.map((line) => (
        <BulletLine key={line} size={13} lineHeight={17.5}>{line}</BulletLine>
      ))}
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({ card: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, gap: 8 } }));
