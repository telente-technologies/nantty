import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/errorState";
import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { providerWalletQueryKeys, useProviderWallet } from "@/components/wallet/providerWalletQueries.hook";
import { WalletAccountDetails } from "@/components/wallet/walletAccountDetails";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { providerWalletService } from "@/services/money/providerWallet.service";
import { useTheme } from "@/theme";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";
import { OUTSIDE_NIGERIA_NOTE, paymentPartnerLine } from "@/utils/paymentCopy.util";
import { presentPaymentProblem } from "@/utils/paymentProblem.util";
import { describeWalletDailyLimit } from "@/utils/walletLimits.util";

export const ADD_MONEY_NOTES = [
  "Transfer from any Nigerian bank app. It usually arrives in a few minutes.",
  "You can spend it on Zudomart straight away. It can be withdrawn 24 hours after it arrives (72 hours for your first deposit).",
  "Any deposit fee shows on your receipt.",
  "You can pay up to ₦50,000, ₦200,000 or ₦5,000,000 a day from your wallet, depending on your verification level.",
] as const;


export function AddMoneyScreen({ navigation }: MainScreenProps<"AddMoney">) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const { verification, wallet, isNigeria, isMissing } = useProviderWallet();
  const activate = useMutation({
    mutationFn: providerWalletService.activateMyWallet,
    onSuccess: (created) => queryClient.setQueryData(providerWalletQueryKeys.wallet, created),
    onError: (error) => presentPaymentProblem(error, { onVerify: () => navigation.navigate("PayoutSetup") }),
  });
  const loading = verification.isPending || (isNigeria === true && wallet.isPending);
  const data = wallet.data;

  return (
    <Screen>
      <Header title="Add money" />
      <ScrollView contentContainerStyle={styles.content}>
        {loading ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : null}
        {verification.isError ? <ErrorState message="Couldn't load your wallet." onRetry={() => verification.refetch()} retrying={verification.isRefetching} /> : null}
        {isNigeria === false ? <Text size={14} lineHeight={20}>{OUTSIDE_NIGERIA_NOTE}</Text> : null}
        {isNigeria && isMissing ? (
          <View style={styles.section}>
            <Text size={15} weight={600} lineHeight={20}>Get your own account number</Text>
            <Text size={13} lineHeight={18} color={colors.textMuted}>
              Finish payout verification to get your own account number. Your wallet is held in your name by our licensed payment partner, not by Zudomart.
            </Text>
            {verification.data?.payoutVerified ? (
              <Button title="Create my account number" loading={activate.isPending} onPress={() => activate.mutate()} />
            ) : (
              <Button title="Finish verification" onPress={() => navigation.navigate("PayoutSetup")} />
            )}
          </View>
        ) : null}
        {isNigeria && wallet.isError && !isMissing ? <ErrorState message={wallet.error.message} onRetry={() => wallet.refetch()} retrying={wallet.isRefetching} /> : null}
        {data ? (
          <View style={styles.section}>
            {data.wallet.status !== "active" ? (
              <Text size={13} lineHeight={18} color={colors.error}>Your wallet is on hold while we check it. Contact support if this lasts.</Text>
            ) : null}
            <WalletAccountDetails wallet={data.wallet} />
            <Text size={13} lineHeight={18} color={colors.textMuted}>
              Available {formatMoneyForDisplay({ amountMinor: data.balances.availableMinor + data.balances.depositHoldMinor, currency: "NGN" })}
              {data.balances.depositHoldMinor > 0 ? ` (${formatMoneyForDisplay({ amountMinor: data.balances.depositHoldMinor, currency: "NGN" })} on deposit hold)` : ""}
            </Text>
            {[...ADD_MONEY_NOTES.slice(0, -1), describeWalletDailyLimit(data.limits) ?? ADD_MONEY_NOTES[ADD_MONEY_NOTES.length - 1]].map((note) => (
              <Text key={note} size={13} lineHeight={18} color={colors.textMuted}>• {note}</Text>
            ))}
            <Text size={12} lineHeight={16} color={colors.textMuted}>{paymentPartnerLine(data.wallet.provider)}</Text>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40, gap: 16 },
  section: { gap: 12 },
  loading: { marginTop: 40 },
});
