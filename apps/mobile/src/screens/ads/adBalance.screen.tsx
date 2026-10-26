import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { ErrorState } from "@/components/ui/errorState";
import { Header } from "@/components/ui/header";
import { TextField } from "@/components/ui/input";
import { KeyboardAwareForm } from "@/components/ui/keyboardAwareForm";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { usePullToRefresh } from "@/components/ui/pullToRefresh.hook";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useStepUpPrompt } from "@/components/wallet/stepUpSheet";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { adsHubService } from "@/services/ads/adsHub.service";
import { paymentsService } from "@/services/commerce/payments.service";
import { generateIdempotencyKey } from "@/services/core/apiClient.service";
import { makeThemedStyles, useTheme } from "@/theme";
import type { AdBalance } from "@/types/boost.type";
import type { Money } from "@/types";
import { adBalancePotLabel, adBalanceTransactionReason, adCreditLotExpiryLabel, createStableIdempotencyKeys, parseMoneyInput } from "@/utils/adsHub.util";
import { boostErrorMessage } from "@/utils/boostPayment.util";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

const AD_BALANCE_QUERY_KEY = ["ads", "balance"] as const;

export function AdBalanceScreen({ navigation }: MainScreenProps<"AdBalance">) {
  const { colors } = useTheme();
  const styles = useStyles();
  const balance = useQuery({ queryKey: AD_BALANCE_QUERY_KEY, queryFn: adsHubService.fetchAdBalance });
  const history = useInfiniteQuery({
    queryKey: ["ads", "balance", "transactions"],
    queryFn: ({ pageParam }) => adsHubService.listAdBalanceTransactions(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const refreshControl = usePullToRefresh(balance.refetch, history.refetch);
  if (!balance.data) {
    return (
      <Screen>
        <Header title="Ad credit & balance" />
        {balance.isError ? <ErrorState error={balance.error} message="Couldn't load your ad balance." onRetry={() => balance.refetch()} retrying={balance.isRefetching} /> : <ListSkeleton />}
      </Screen>
    );
  }
  const data = balance.data;
  const transactions = history.data?.pages.flatMap((page) => page.data) ?? [];
  return (
    <Screen>
      <Header title="Ad credit & balance" />
      <KeyboardAwareForm contentContainerStyle={styles.content} refreshControl={refreshControl}>
        <View style={styles.pots}>
          <View style={styles.pot} accessible accessibilityLabel={`Ad balance, withdrawable: ${formatMoneyForDisplay(data.balance)}`}>
            <Text size={12} lineHeight={16} color={colors.textMuted}>Ad balance (withdrawable)</Text>
            <Text size={20} weight={600} lineHeight={24}>{formatMoneyForDisplay(data.balance)}</Text>
          </View>
          <View style={styles.pot} accessible accessibilityLabel={`Ad credit, ads only: ${formatMoneyForDisplay(data.credit)}`}>
            <Text size={12} lineHeight={16} color={colors.textMuted}>Ad credit (ads only)</Text>
            <Text size={20} weight={600} lineHeight={24}>{formatMoneyForDisplay(data.credit)}</Text>
          </View>
        </View>
        <View style={styles.card}>
          <Text size={13} lineHeight={16.9}>You can spend {formatMoneyForDisplay(data.spendable)} on ads. Credit is used first.</Text>
          {data.committed.amountMinor > 0 ? <Text size={12} lineHeight={16} color={colors.textMuted}>{formatMoneyForDisplay(data.committed)} is reserved by ads that are running or in review.</Text> : null}
          {data.pendingSettlement.amountMinor > 0 ? <Text size={12} lineHeight={16} color={colors.textMuted}>{formatMoneyForDisplay(data.pendingSettlement)} from recent top-ups can be withdrawn 24 hours after it arrives.</Text> : null}
          {data.cashback.enabled ? <Text size={12} lineHeight={16} color={colors.textMuted}>You get {data.cashback.percent}% of your ad spend back as ad credit.</Text> : null}
          <Text size={12} lineHeight={16} color={colors.textMuted}>Ad credit can only be spent on ads. It can't be withdrawn.</Text>
        </View>
        {data.creditLots.length > 0 ? (
          <View style={styles.section}>
            <Text size={14} weight={600} lineHeight={16.8}>Your ad credit</Text>
            {data.creditLots.map((lot) => (
              <View key={lot.id} style={styles.row} accessible accessibilityLabel={`${adCreditLotExpiryLabel(lot)}${lot.reason ? `. ${lot.reason}` : ""}`}>
                <Text size={13} lineHeight={16.9}>{adCreditLotExpiryLabel(lot)}</Text>
                {lot.reason ? <Text size={12} lineHeight={16} color={colors.textMuted}>{lot.reason}</Text> : null}
              </View>
            ))}
          </View>
        ) : null}
        <TopUpSection balance={data} />
        <WithdrawSection balance={data} onVerify={() => navigation.navigate("PayoutSetup")} />
        <View style={styles.section}>
          <Text size={14} weight={600} lineHeight={16.8}>History</Text>
          {history.isPending ? <ActivityIndicator color={colors.primary} accessibilityLabel="Loading history" /> : null}
          {history.isError ? <ErrorState error={history.error} message="Couldn't load your history." variant="inline" onRetry={() => history.refetch()} /> : null}
          {!history.isPending && !history.isError && transactions.length === 0 ? <Text size={13} lineHeight={16.9} color={colors.textMuted}>Nothing here yet.</Text> : null}
          {transactions.map((transaction) => (
            <View key={transaction.id} style={styles.historyRow} accessible accessibilityLabel={`${adBalanceTransactionReason(transaction.kind)}, ${adBalancePotLabel(transaction.pot)}, ${formatMoneyForDisplay(transaction.amount)}, ${new Date(transaction.createdAt).toLocaleDateString()}`}>
              <View style={styles.flex}>
                <Text size={13} weight={500} lineHeight={16.9}>{adBalanceTransactionReason(transaction.kind)}</Text>
                <Text size={12} lineHeight={16} color={colors.textMuted} numberOfLines={1}>{adBalancePotLabel(transaction.pot)} · {new Date(transaction.createdAt).toLocaleDateString()}{transaction.description ? ` · ${transaction.description}` : ""}</Text>
              </View>
              <Text size={13} weight={600} lineHeight={16.9} color={transaction.amount.amountMinor < 0 ? colors.text : colors.successText}>
                {transaction.amount.amountMinor > 0 ? "+" : ""}{formatMoneyForDisplay(transaction.amount)}
              </Text>
            </View>
          ))}
          {history.hasNextPage ? <Button variant="subtle" title="Show more" loading={history.isFetchingNextPage} onPress={() => history.fetchNextPage()} /> : null}
        </View>
      </KeyboardAwareForm>
    </Screen>
  );
}

function TopUpSection({ balance }: { readonly balance: AdBalance }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState<Money | null>(balance.topUp.suggested[0] ?? null);
  const [customText, setCustomText] = useState("");
  const idempotencyKeys = useRef(createStableIdempotencyKeys(generateIdempotencyKey)).current;
  const currency = balance.topUp.minimum.currency;
  const tooSmall = !!amount && amount.amountMinor < balance.topUp.minimum.amountMinor;
  const tooLarge = !!amount && amount.amountMinor > balance.topUp.maximum.amountMinor;
  const topUp = useMutation({
    mutationFn: async () => {
      const checkout = await adsHubService.startAdBalanceTopUp(amount!, idempotencyKeys.keyFor(amount));
      await paymentsService.openHostedCheckoutInAppBrowser(checkout.checkoutUrl);
      return checkout;
    },
    onSuccess: () => {
      idempotencyKeys.reset();
      void queryClient.invalidateQueries({ queryKey: ["ads"] });
    },
  });
  return (
    <View style={styles.section}>
      <Text size={14} weight={600} lineHeight={16.8}>Top up ad balance</Text>
      {!balance.topUp.available ? (
        <Text size={13} lineHeight={16.9} color={colors.textMuted}>{balance.topUp.reason ?? "Top-ups aren't available right now."}</Text>
      ) : (
        <>
          <View style={styles.chips}>
            {balance.topUp.suggested.map((suggestion) => (
              <Chip key={suggestion.amountMinor} label={formatMoneyForDisplay(suggestion, { showDecimals: false })} selected={!customText && amount?.amountMinor === suggestion.amountMinor} onPress={() => { setCustomText(""); setAmount(suggestion); }} />
            ))}
          </View>
          <TextField label="Or enter an amount" keyboardType="decimal-pad" value={customText} accessibilityLabel={`Top-up amount in ${currency}`} onChangeText={(text) => { setCustomText(text); setAmount(parseMoneyInput(text, currency)); }} />
          <Text size={12} lineHeight={16} color={tooSmall || tooLarge ? colors.error : colors.textMuted}>
            Between {formatMoneyForDisplay(balance.topUp.minimum)} and {formatMoneyForDisplay(balance.topUp.maximum)}. Paid by card or bank transfer in a secure payment window.
          </Text>
          {topUp.isError ? <Text size={12} lineHeight={16} color={colors.error} accessibilityLiveRegion="assertive">{boostErrorMessage(topUp.error)}</Text> : null}
          <Button title={amount ? `Top up ${formatMoneyForDisplay(amount)}` : "Top up"} disabled={!amount || tooSmall || tooLarge} loading={topUp.isPending} onPress={() => topUp.mutate()} />
        </>
      )}
    </View>
  );
}

function WithdrawSection({ balance, onVerify }: { readonly balance: AdBalance; readonly onVerify: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const queryClient = useQueryClient();
  const [amountText, setAmountText] = useState("");
  const idempotencyKeys = useRef(createStableIdempotencyKeys(generateIdempotencyKey)).current;
  const { withStepUp, stepUpSheet } = useStepUpPrompt();
  const currency = balance.withdrawable.currency;
  const amount = parseMoneyInput(amountText, currency);
  const quote = useQuery({ queryKey: ["ads", "withdrawalQuote", amount], queryFn: () => adsHubService.quoteAdBalanceWithdrawal(amount!), enabled: !!amount && balance.withdrawal.available });
  const withdraw = useMutation({
    mutationFn: () => {
      const idempotencyKey = idempotencyKeys.keyFor(amount);
      return withStepUp((stepUpToken) => adsHubService.withdrawAdBalance(amount!, idempotencyKey, stepUpToken));
    },
    onSuccess: () => {
      idempotencyKeys.reset();
      setAmountText("");
      void queryClient.invalidateQueries({ queryKey: ["ads"] });
      void queryClient.invalidateQueries({ queryKey: ["wallet"] });
    },
  });
  return (
    <View style={styles.section}>
      {stepUpSheet}
      <Text size={14} weight={600} lineHeight={16.8}>Withdraw ad balance</Text>
      <Text size={12} lineHeight={16} color={colors.textMuted}>{formatMoneyForDisplay(balance.withdrawable)} can be withdrawn to your Nantty wallet now.</Text>
      {!balance.withdrawal.available ? (
        <>
          <Text size={13} lineHeight={16.9} color={colors.textMuted}>{balance.withdrawal.reason ?? "Withdrawals aren't available right now."}</Text>
          {balance.withdrawal.reasonCode === "VERIFICATION_REQUIRED" ? <Button variant="subtle" title="Verify payouts" onPress={onVerify} /> : null}
        </>
      ) : (
        <>
          <TextField label="Amount to withdraw" keyboardType="decimal-pad" value={amountText} onChangeText={setAmountText} accessibilityLabel={`Withdrawal amount in ${currency}`} />
          {quote.isFetching && !quote.data ? <ActivityIndicator color={colors.primary} accessibilityLabel="Getting the fee" /> : null}
          {quote.isError ? <Text size={12} lineHeight={16} color={colors.error}>{boostErrorMessage(quote.error)}</Text> : null}
          {quote.data && amount ? (
            <View style={styles.row} accessibilityLiveRegion="polite">
              <Text size={13} lineHeight={16.9}>Payment provider fee: {formatMoneyForDisplay(quote.data.fee)}</Text>
              <Text size={13} weight={600} lineHeight={16.9}>You get {formatMoneyForDisplay(quote.data.net)} in your wallet</Text>
            </View>
          ) : null}
          {withdraw.isError ? <Text size={12} lineHeight={16} color={colors.error} accessibilityLiveRegion="assertive">{boostErrorMessage(withdraw.error)}</Text> : null}
          {withdraw.isSuccess ? <Text size={12} lineHeight={16} color={colors.successText}>Withdrawn to your wallet.</Text> : null}
          <Button title={quote.data && amount ? `Withdraw ${formatMoneyForDisplay(quote.data.amount)}` : "Withdraw"} disabled={!amount || !quote.data} loading={withdraw.isPending} onPress={() => withdraw.mutate()} />
        </>
      )}
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32, gap: 16 },
  pots: { flexDirection: "row", gap: 8 },
  pot: { flex: 1, backgroundColor: colors.surface, borderRadius: 12, padding: 14, gap: 4 },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, gap: 6 },
  section: { gap: 8 },
  row: { backgroundColor: colors.surface, borderRadius: 12, padding: 12, gap: 2 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  historyRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  flex: { flex: 1, gap: 2 },
}));
