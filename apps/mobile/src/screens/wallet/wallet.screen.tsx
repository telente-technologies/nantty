import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { BuyCoinsSheet } from "@/components/coins/buyCoinsSheet";
import { CoinBalanceChip } from "@/components/coins/coinBalanceChip";
import { PayoutSetupCard } from "@/components/payoutOnboarding/payoutSetupCard";
import { SettingsGroup, SettingsRow } from "@/components/settings/settingsGroup";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/errorState";
import { Header } from "@/components/ui/header";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { usePullToRefresh } from "@/components/ui/pullToRefresh.hook";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { EscrowHoldRow } from "@/components/wallet/escrowHoldRow";
import { TransactionRow } from "@/components/wallet/transactionRow";
import { VerifyToWithdrawBanner } from "@/components/wallet/verifyToWithdrawBanner";
import { WalletBalanceCards } from "@/components/wallet/walletBalanceCards";
import { WalletFundingCard } from "@/components/wallet/walletFundingCard";
import {
  useEscrowHoldsQuery,
  useWalletBalanceQuery,
  useWalletTransactionsQuery,
} from "@/components/wallet/walletQueries.hook";
import { useTheme } from "@/theme";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { spacing } from "@/constants/spacing.constant";
import { typeScale } from "@/constants/typography.constant";
import { walletVerificationMessage } from "@/utils/walletLines.util";

export function WalletScreen({ navigation }: MainScreenProps<"Wallet">) {
  const { colors } = useTheme();
  const balance = useWalletBalanceQuery();
  const transactionsQuery = useWalletTransactionsQuery();
  const escrowQuery = useEscrowHoldsQuery();
  const wallet = balance.data;
  const transactions = transactionsQuery.data ?? [];
  const escrowHolds = escrowQuery.data ?? [];
  const refreshControl = usePullToRefresh(balance.refetch, transactionsQuery.refetch, escrowQuery.refetch);
  const [isBuyCoinsSheetOpen, setIsBuyCoinsSheetOpen] = useState(false);

  return (
    <Screen>
      <Header title="Wallet" />
      {balance.isError && !wallet ? (
        <ErrorState message="Couldn't load your wallet." onRetry={() => balance.refetch()} retrying={balance.isRefetching} />
      ) : (
      <ScrollView contentContainerStyle={styles.content} refreshControl={refreshControl}>
        {walletVerificationMessage(wallet) ? <VerifyToWithdrawBanner wallet={wallet} /> : <PayoutSetupCard />}
        <WalletBalanceCards wallet={wallet} />
        <WalletFundingCard />
        <Text size={typeScale.xs} lineHeight={16.8} color={colors.textMuted}>
          Each balance is kept separately. Escrow money is released when buyers confirm delivery (or 3 days after delivery), then passes a short safety hold before it becomes available.
        </Text>
        <Button title="Withdraw" disabled={!wallet || wallet.available.amountMinor <= 0} onPress={() => navigation.navigate("Withdraw")} />

        {escrowHolds.length > 0 ? (
          <View style={styles.section}>
            <Text size={typeScale.base} weight={500} lineHeight={19.2}>Held in escrow</Text>
            <SettingsGroup>
              {escrowHolds.map((hold) => (
                <EscrowHoldRow key={hold.orderId} hold={hold} onPress={() => navigation.navigate("SellerOrderDetail", { orderId: hold.orderId })} />
              ))}
            </SettingsGroup>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text size={typeScale.base} weight={500} lineHeight={19.2}>Coins</Text>
          <Text size={typeScale.xs} lineHeight={16.8} color={colors.textMuted}>
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
          <Text size={typeScale.base} weight={500} lineHeight={19.2}>Recent activity</Text>
          {transactionsQuery.isPending ? (
            <ListSkeleton rows={3} avatarSize={40} padding={0} />
          ) : transactionsQuery.isError ? (
            <ErrorState compact message="Couldn't load recent activity." onRetry={() => transactionsQuery.refetch()} retrying={transactionsQuery.isRefetching} />
          ) : transactions.length === 0 ? (
            <Text size={typeScale.sm} lineHeight={18} color={colors.textMuted}>No activity yet. Payments, refunds and payouts will show up here.</Text>
          ) : (
            <SettingsGroup>
              {transactions.slice(0, 5).map((transaction) => (
                <TransactionRow key={transaction.id} transaction={transaction} />
              ))}
            </SettingsGroup>
          )}
        </View>
      </ScrollView>
      )}
      <BuyCoinsSheet visible={isBuyCoinsSheetOpen} onClose={() => setIsBuyCoinsSheetOpen(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing[4], paddingTop: spacing[2], paddingBottom: spacing[8], gap: spacing[4] },
  section: { gap: spacing[3] },
});
