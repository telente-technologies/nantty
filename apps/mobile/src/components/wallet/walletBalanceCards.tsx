import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { colors, palette } from "@/constants/colors.constant";
import type { WalletSummary } from "@/types";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

export function WalletBalanceCards({ wallet }: { wallet: WalletSummary | undefined }) {
  return (
    <View style={styles.row}>
      <View style={[styles.card, styles.available]} accessibilityLabel={`Available to withdraw ${wallet ? formatMoneyForDisplay(wallet.available) : ""}`}>
        <Text size={12} weight={500} lineHeight={14.4} color={palette.primary[100]}>Available to withdraw</Text>
        <Text size={21} weight={600} lineHeight={25.2} color={colors.white} numberOfLines={1} adjustsFontSizeToFit>
          {wallet ? formatMoneyForDisplay(wallet.available) : " "}
        </Text>
      </View>
      <View style={[styles.card, styles.pending]} accessibilityLabel={`Pending in escrow ${wallet ? formatMoneyForDisplay(wallet.pending) : ""}`}>
        <Text size={12} weight={500} lineHeight={14.4} color={palette.caution[800]}>Pending in escrow</Text>
        <Text size={21} weight={600} lineHeight={25.2} numberOfLines={1} adjustsFontSizeToFit>
          {wallet ? formatMoneyForDisplay(wallet.pending) : " "}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8 },
  card: { flex: 1, borderRadius: 12, padding: 14, gap: 8 },
  available: { backgroundColor: colors.primary },
  pending: { backgroundColor: palette.caution[50] },
});
