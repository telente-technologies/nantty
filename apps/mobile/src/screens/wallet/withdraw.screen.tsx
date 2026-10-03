import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { CaretRight24Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/ui/header";
import { TextField } from "@/components/ui/input";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { usePayoutFeesQuery, usePayoutOnboardingQuery } from "@/components/payoutOnboarding/payoutOnboardingQueries.hook";
import { usePayoutAccountsQuery, useWalletBalanceQuery } from "@/components/wallet/walletQueries.hook";
import { makeThemedStyles, useTheme } from "@/theme";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { generateIdempotencyKey } from "@/services/apiClient.service";
import { walletsService } from "@/services/wallets.service";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

const convertMajorUnitTextToMinorUnits = (value: string) => Math.round(Number.parseFloat(value || "0") * 100);

export function WithdrawScreen({ navigation }: MainScreenProps<"Withdraw">) {
  const { colors } = useTheme();
  const styles = useStyles();
  const queryClient = useQueryClient();
  const { data: wallet } = useWalletBalanceQuery();
  const { data: payoutAccounts = [] } = usePayoutAccountsQuery();
  const { data: onboarding } = usePayoutOnboardingQuery();
  const { data: fees } = usePayoutFeesQuery();
  const payoutsLocked = !onboarding?.withdrawalsEnabled;
  const [amountText, setAmountText] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const idempotencyKey = useRef(generateIdempotencyKey());

  const payoutAccountId = selectedAccountId ?? payoutAccounts[0]?.id ?? null;
  const amountMinor = convertMajorUnitTextToMinorUnits(amountText);
  const available = wallet?.available;
  const feeMinor = fees && available && fees.fee.currency === available.currency ? fees.fee.amountMinor : 0;
  const exceedsBalance = !!available && amountMinor + feeMinor > available.amountMinor;

  const requestWithdrawal = useMutation({
    mutationFn: () =>
      walletsService.requestWithdrawalToPayoutAccount(
        { payoutAccountId: payoutAccountId!, amount: { amountMinor, currency: available!.currency } },
        idempotencyKey.current,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      navigation.goBack();
    },
  });

  return (
    <Screen>
      <Header title="Withdraw" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text size={14} lineHeight={16.8} color={colors.textMuted}>
          Available: {available ? formatMoneyForDisplay(available) : "…"}
        </Text>
        {payoutsLocked ? (
          <View style={styles.locked}>
            <Text size={14} weight={600} lineHeight={16.8}>Withdrawals are locked</Text>
            <Text size={13} lineHeight={18} color={colors.textMuted}>
              Finish payout setup to withdraw. Your earnings keep building and nothing is lost while you do.
            </Text>
          </View>
        ) : null}
        <TextField
          editable={!payoutsLocked}
          label={`Amount (${available?.currency ?? ""})`}
          placeholder="0.00"
          keyboardType="decimal-pad"
          value={amountText}
          onChangeText={(value) => setAmountText(value.replace(/[^\d.]/g, ""))}
          invalid={exceedsBalance}
        />
        {fees ? (
          <View style={styles.feeBox}>
            <Text size={13} lineHeight={18} color={colors.textMuted}>
              Payout fee: {formatMoneyForDisplay(fees.fee)} flat per withdrawal, added on top of the amount. {fees.arrivalEstimate}
            </Text>
            <Text size={12} lineHeight={16.8} color={colors.textSubtle}>{fees.firstPayoutNote}</Text>
          </View>
        ) : null}
        {exceedsBalance ? (
          <Text size={12} lineHeight={14.4} color={colors.error}>
            That's more than your available balance.
          </Text>
        ) : null}
        <Text size={16} weight={500} lineHeight={19.2}>
          Send to
        </Text>
        <View style={styles.accounts}>
          {payoutAccounts.map((account) => {
            const selected = account.id === payoutAccountId;
            return (
              <Pressable
                key={account.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={`${account.bankName} ${account.accountNumberMasked}, ${account.accountName}`}
                onPress={() => setSelectedAccountId(account.id)}
                style={[styles.account, selected && styles.accountSelected]}
              >
                <View>
                  <Text size={14} weight={500} lineHeight={16.8}>
                    {account.bankName} {account.accountNumberMasked}
                  </Text>
                  <Text size={12} lineHeight={16.8} color={colors.textMuted}>
                    {account.accountName}
                  </Text>
                </View>
                <View style={[styles.radio, selected && styles.radioSelected]} />
              </Pressable>
            );
          })}
          <Pressable accessibilityRole="button" onPress={() => navigation.navigate("PayoutAccounts")} style={styles.account}>
            <Text size={14} lineHeight={16.8} color={colors.primary}>
              {payoutAccounts.length ? "Manage payout accounts" : "Add a payout account"}
            </Text>
            <CaretRight24Icon />
          </Pressable>
        </View>
        {requestWithdrawal.isError ? (
          <Text size={12} lineHeight={14.4} color={colors.error}>
            {requestWithdrawal.error.message}
          </Text>
        ) : null}
        {payoutsLocked ? (
          <Button title="Finish payout setup" onPress={() => navigation.navigate("PayoutSetup")} />
        ) : (
          <Button
            title="Withdraw"
            disabled={!available || !payoutAccountId || amountMinor <= 0 || exceedsBalance}
            loading={requestWithdrawal.isPending}
            onPress={() => requestWithdrawal.mutate()}
          />
        )}
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 40, gap: 16 },
  locked: { backgroundColor: colors.cautionTint, borderRadius: 12, padding: 14, gap: 4 },
  feeBox: { gap: 4 },
  accounts: { backgroundColor: colors.surface, borderRadius: 12, overflow: "hidden" },
  account: { minHeight: 56, paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: colors.background },
  accountSelected: { backgroundColor: colors.primaryTint },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: colors.textSubtle },
  radioSelected: { borderColor: colors.primary, borderWidth: 5 },
}));
