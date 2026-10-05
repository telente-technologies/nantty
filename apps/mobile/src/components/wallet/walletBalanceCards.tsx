import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { palette } from "@/constants/colors.constant";
import { makeThemedStyles, useTheme } from "@/theme";
import type { WalletSummary } from "@/types";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";
import { spacing } from "@/constants/spacing.constant";
import { typeScale } from "@/constants/typography.constant";

export function WalletBalanceCards({ wallet }: { wallet: WalletSummary | undefined }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <View style={[styles.card, styles.available]} accessibilityLabel={`Available to withdraw ${wallet ? formatMoneyForDisplay(wallet.available) : ""}`}>
        <Text size={typeScale.xs} weight={500} lineHeight={14.4} color={palette.primary[100]}>Available to withdraw</Text>
        <Text size={21} weight={600} lineHeight={25.2} color={colors.white} numberOfLines={1} adjustsFontSizeToFit>
          {wallet ? formatMoneyForDisplay(wallet.available) : " "}
        </Text>
      </View>
      <View style={[styles.card, styles.pending]} accessibilityLabel={`Pending in escrow ${wallet ? formatMoneyForDisplay(wallet.pending) : ""}`}>
        <Text size={typeScale.xs} weight={500} lineHeight={14.4} color={colors.cautionStrongText}>Pending in escrow</Text>
        <Text size={21} weight={600} lineHeight={25.2} numberOfLines={1} adjustsFontSizeToFit>
          {wallet ? formatMoneyForDisplay(wallet.pending) : " "}
        </Text>
      </View>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  row: { flexDirection: "row", gap: spacing[2] },
  card: { flex: 1, borderRadius: 12, padding: 14, gap: spacing[2] },
  available: { backgroundColor: colors.primarySolid },
  pending: { backgroundColor: colors.cautionTint },
}));
