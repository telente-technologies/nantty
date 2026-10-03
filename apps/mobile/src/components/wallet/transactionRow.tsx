import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { WalletTransaction } from "@/types";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

export function TransactionRow({ transaction }: { transaction: WalletTransaction }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const isCredit = transaction.kind === "credit";
  return (
    <View style={styles.row} accessibilityLabel={`${transaction.description}, ${isCredit ? "received" : "sent"} ${formatMoneyForDisplay(transaction.amount)}, ${transaction.status}`}>
      <View style={styles.details}>
        <Text size={14} lineHeight={16.8} numberOfLines={1}>
          {transaction.description}
        </Text>
        <Text size={12} lineHeight={16.8} color={colors.textSubtle}>
          {new Date(transaction.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
          {transaction.status !== "completed" ? ` · ${transaction.status === "pending" ? "Pending" : "Failed"}` : ""}
        </Text>
      </View>
      <Text size={14} weight={600} lineHeight={16.8} color={isCredit ? colors.success : colors.text}>
        {isCredit ? "+" : "−"}
        {formatMoneyForDisplay(transaction.amount)}
      </Text>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  row: { backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 12 },
  details: { flex: 1, gap: 2 },
}));
