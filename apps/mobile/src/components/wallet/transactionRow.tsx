import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { WalletTransaction } from "@/types";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";
import { spacing } from "@/constants/spacing.constant";
import { typeScale } from "@/constants/typography.constant";

export function TransactionRow({ transaction }: { transaction: WalletTransaction }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const isCredit = transaction.kind === "credit";
  return (
    <View style={styles.row} accessibilityLabel={`${transaction.description}, ${isCredit ? "received" : "sent"} ${formatMoneyForDisplay(transaction.amount)}, ${transaction.status}`}>
      <View style={styles.details}>
        <Text size={typeScale.md} lineHeight={16.8} numberOfLines={1}>
          {transaction.description}
        </Text>
        <Text size={typeScale.xs} lineHeight={16.8} color={colors.textSubtle}>
          {new Date(transaction.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
          {transaction.status !== "completed" ? ` · ${transaction.status === "pending" ? "Pending" : "Failed"}` : ""}
        </Text>
      </View>
      <Text size={typeScale.md} weight={600} lineHeight={16.8} color={isCredit ? colors.success : colors.text}>
        {isCredit ? "+" : "−"}
        {formatMoneyForDisplay(transaction.amount)}
      </Text>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  row: { backgroundColor: colors.surface, paddingHorizontal: spacing[3], paddingVertical: spacing[3], flexDirection: "row", alignItems: "center", gap: spacing[3] },
  details: { flex: 1, gap: 2 },
}));
