import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ScrollView, StyleSheet } from "react-native";

import { SettingsGroup, SettingsRow } from "@/components/settings/settingsGroup";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/ui/header";
import { TextField } from "@/components/ui/input";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { BankPickerField } from "@/components/wallet/bankPickerSheet";
import { usePayoutAccountsQuery, walletQueryKeys } from "@/components/wallet/walletQueries.hook";
import { useTheme } from "@/theme";
import { walletsService } from "@/services/wallets.service";
import { showAlertWithButtons } from "@/utils/crossPlatformAlert.util";
import { ErrorState } from "@/components/ui/errorState";
import { usePullToRefresh } from "@/components/ui/pullToRefresh.hook";
import { Skeleton } from "@/components/ui/skeleton";
import { showToast } from "@/store/toast.store";
import { spacing } from "@/constants/spacing.constant";
import { typeScale } from "@/constants/typography.constant";

export function PayoutAccountsScreen() {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const accountsQuery = usePayoutAccountsQuery();
  const accounts = accountsQuery.data ?? [];
  const refreshControl = usePullToRefresh(accountsQuery.refetch);
  const [bankCode, setBankCode] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const refreshPayoutAccounts = () => queryClient.invalidateQueries({ queryKey: walletQueryKeys.payoutAccounts });

  const addAccount = useMutation({
    mutationFn: () => walletsService.addPayoutAccount({ bankCode: bankCode.trim(), accountNumber }),
    onSuccess: () => {
      setBankCode("");
      setBankName("");
      setAccountNumber("");
      refreshPayoutAccounts();
    },
  });
  const removeAccount = useMutation({
    mutationFn: walletsService.removePayoutAccount,
    onSuccess: () => {
      showToast("Account removed");
      return refreshPayoutAccounts();
    },
    onError: () => showToast("Couldn't remove the account. Try again."),
  });

  const confirmAndRemovePayoutAccount = (accountId: string, label: string) =>
    showAlertWithButtons("Remove account?", `${label} will no longer receive withdrawals.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => removeAccount.mutate(accountId) },
    ]);

  return (
    <Screen>
      <Header title="Payout accounts" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" refreshControl={refreshControl}>
        {accountsQuery.isPending ? (
          <Skeleton height={48} radius={12} />
        ) : accountsQuery.isError ? (
          <ErrorState compact message="Couldn't load your payout accounts." onRetry={() => accountsQuery.refetch()} retrying={accountsQuery.isRefetching} />
        ) : accounts.length ? (
          <SettingsGroup>
            {accounts.map((account) => (
              <SettingsRow
                key={account.id}
                label={`${account.bankName} ${account.accountNumberMasked}`}
                trailing={{ text: "Remove", color: colors.error }}
                onPress={() => confirmAndRemovePayoutAccount(account.id, `${account.bankName} ${account.accountNumberMasked}`)}
              />
            ))}
          </SettingsGroup>
        ) : null}
        <Text size={typeScale.base} weight={500} lineHeight={19.2}>
          Add a bank account
        </Text>
        <BankPickerField
          selectedBankCode={bankCode}
          selectedBankName={bankName}
          onSelectBank={(bank) => {
            setBankCode(bank.code);
            setBankName(bank.name);
          }}
        />
        <TextField
          label="Account number"
          placeholder="10-digit account number"
          keyboardType="number-pad"
          maxLength={10}
          value={accountNumber}
          onChangeText={(value) => setAccountNumber(value.replace(/\D/g, ""))}
        />
        <Text size={typeScale.xs} lineHeight={16.8} color={colors.textSubtle}>
          We verify the account name with your bank. Withdrawals can only go to an account in your name.
        </Text>
        {addAccount.isError ? (
          <Text size={typeScale.xs} lineHeight={14.4} color={colors.error}>
            {addAccount.error.message}
          </Text>
        ) : null}
        <Button title="Add account" disabled={!bankCode.trim() || accountNumber.length !== 10} loading={addAccount.isPending} onPress={() => addAccount.mutate()} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({ content: { paddingHorizontal: spacing[4], paddingTop: spacing[6], paddingBottom: spacing[8], gap: spacing[4] } });
