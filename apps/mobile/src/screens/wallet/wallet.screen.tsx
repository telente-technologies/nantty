import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";

import { BuyCoinsSheet } from "@/components/coins/buyCoinsSheet";
import { CoinBalanceChip } from "@/components/coins/coinBalanceChip";
import { PayoutSetupCard } from "@/components/payoutOnboarding/payoutSetupCard";
import { SettingsGroup, SettingsRow } from "@/components/settings/settingsGroup";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { EscrowHoldRow } from "@/components/wallet/escrowHoldRow";
import { TransactionRow } from "@/components/wallet/transactionRow";
import { WalletBalanceCards } from "@/components/wallet/walletBalanceCards";
import {
  useEscrowHoldsQuery,
  useWalletBalanceQuery,
  useWalletTransactionsQuery,
} from "@/components/wallet/walletQueries.hook";
import { useTheme } from "@/theme";
import type { MainScreenProps } from "@/navigation/navigation.types";

export function WalletScreen({ navigation }: MainScreenProps<"Wallet">) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const { data: wallet, isRefetching } = useWalletBalanceQuery();
  const { data: transactions = [] } = useWalletTransactionsQuery();
  const { data: escrowHolds = [] } = useEscrowHoldsQuery();
  const [isBuyCoinsSheetOpen, setIsBuyCoinsSheetOpen] = useState(false);

  return (
    <Screen>
      <Header title="Wallet" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => queryClient.invalidateQueries({ queryKey: ["wallet"] })} tintColor={colors.primary} />}
      >
        <PayoutSetupCard />
        <WalletBalanceCards wallet={wallet} />
        <Text size={12} lineHeight={16.8} color={colors.textMuted}>
          Pending money is held in escrow until buyers confirm delivery (or 3 days after delivery). It then moves to your available balance.
        </Text>
        <Button title="Withdraw" disabled={!wallet || wallet.available.amountMinor <= 0} onPress={() => navigation.navigate("Withdraw")} />

        {escrowHolds.length > 0 ? (
          <View style={styles.section}>
            <Text size={16} weight={500} lineHeight={19.2}>Held in escrow</Text>
            <SettingsGroup>
              {escrowHolds.map((hold) => (
                <EscrowHoldRow key={hold.orderId} hold={hold} onPress={() => navigation.navigate("SellerOrderDetail", { orderId: hold.orderId })} />
              ))}
            </SettingsGroup>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text size={16} weight={500} lineHeight={19.2}>Coins</Text>
          <Text size={12} lineHeight={16.8} color={colors.textMuted}>
            Use coins to send gifts and tips to creators, or send them to friends from their profile.
          </Text>
          <CoinBalanceChip onPress={() => setIsBuyCoinsSheetOpen(true)} />
        </View>


        <SettingsGroup>
          <SettingsRow label="Payout accounts" onPress={() => navigation.navigate("PayoutAccounts")} />
          <SettingsRow label="Store rewards" onPress={() => navigation.navigate("StoreRewards")} />
          <SettingsRow label="All transactions" onPress={() => navigation.navigate("Transactions")} />
        </SettingsGroup>

        <View style={styles.section}>
          <Text size={16} weight={500} lineHeight={19.2}>Recent activity</Text>
          <SettingsGroup>
            {transactions.slice(0, 5).map((transaction) => (
              <TransactionRow key={transaction.id} transaction={transaction} />
            ))}
          </SettingsGroup>
        </View>
      </ScrollView>
      <BuyCoinsSheet visible={isBuyCoinsSheetOpen} onClose={() => setIsBuyCoinsSheetOpen(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40, gap: 16 },
  section: { gap: 12 },
});
