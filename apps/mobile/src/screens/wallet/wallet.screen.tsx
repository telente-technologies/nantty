import { ScrollView, StyleSheet, View } from "react-native";

import { SettingsGroup, SettingsRow } from "@/components/settings/settingsGroup";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { TransactionRow } from "@/components/wallet/transactionRow";
import { useWalletBalanceQuery, useWalletTransactionsQuery } from "@/components/wallet/walletQueries.hook";
import { colors } from "@/constants/colors.constant";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

export function WalletScreen({ navigation }: MainScreenProps<"Wallet">) {
  const { data: wallet } = useWalletBalanceQuery();
  const { data: transactions = [] } = useWalletTransactionsQuery();

  return (
    <Screen>
      <Header title="Wallet" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.balance} accessibilityLabel={`Available balance ${wallet ? formatMoneyForDisplay(wallet.available) : ""}`}>
          <Text size={14} weight={500} lineHeight={16.8} color={colors.textMuted}>
            Available balance
          </Text>
          <Text size={28} weight={600} lineHeight={33.6}>
            {wallet ? formatMoneyForDisplay(wallet.available) : " "}
          </Text>
          <Text size={13} lineHeight={16.9} color={colors.textSubtle}>
            {wallet ? `${formatMoneyForDisplay(wallet.pending)} held in escrow` : " "}
          </Text>
        </View>
        <Button title="Withdraw" disabled={!wallet || wallet.available.amountMinor <= 0} onPress={() => navigation.navigate("Withdraw")} />
        <SettingsGroup>
          <SettingsRow label="Payout accounts" onPress={() => navigation.navigate("PayoutAccounts")} />
          <SettingsRow label="All transactions" onPress={() => navigation.navigate("Transactions")} />
        </SettingsGroup>
        <Text size={16} weight={500} lineHeight={19.2}>
          Recent activity
        </Text>
        <SettingsGroup>
          {transactions.slice(0, 5).map((transaction) => (
            <TransactionRow key={transaction.id} transaction={transaction} />
          ))}
        </SettingsGroup>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 40, gap: 24 },
  balance: { alignItems: "center", gap: 8, paddingVertical: 24 },
});
