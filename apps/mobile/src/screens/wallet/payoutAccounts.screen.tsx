import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, ScrollView, StyleSheet } from "react-native";

import { SettingsGroup, SettingsRow } from "@/components/settings/settingsGroup";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/ui/header";
import { TextField } from "@/components/ui/input";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { usePayoutAccountsQuery, walletQueryKeys } from "@/components/wallet/walletQueries.hook";
import { colors } from "@/constants/colors.constant";
import { walletsService } from "@/services/wallets.service";

export function PayoutAccountsScreen() {
  const queryClient = useQueryClient();
  const { data: accounts = [] } = usePayoutAccountsQuery();
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const refreshPayoutAccounts = () => queryClient.invalidateQueries({ queryKey: walletQueryKeys.payoutAccounts });

  const addAccount = useMutation({
    mutationFn: () => walletsService.addPayoutAccount({ bankCode: bankCode.trim(), accountNumber }),
    onSuccess: () => {
      setBankCode("");
      setAccountNumber("");
      refreshPayoutAccounts();
    },
  });
  const removeAccount = useMutation({ mutationFn: walletsService.removePayoutAccount, onSuccess: refreshPayoutAccounts });

  const confirmAndRemovePayoutAccount = (accountId: string, label: string) =>
    Alert.alert("Remove account?", `${label} will no longer receive withdrawals.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => removeAccount.mutate(accountId) },
    ]);

  return (
    <Screen>
      <Header title="Payout accounts" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {accounts.length ? (
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
        <Text size={16} weight={500} lineHeight={19.2}>
          Add a bank account
        </Text>
        <TextField label="Bank code" placeholder="e.g. 058" keyboardType="number-pad" value={bankCode} onChangeText={setBankCode} />
        <TextField
          label="Account number"
          placeholder="10-digit account number"
          keyboardType="number-pad"
          maxLength={10}
          value={accountNumber}
          onChangeText={(value) => setAccountNumber(value.replace(/\D/g, ""))}
        />
        <Text size={12} lineHeight={16.8} color={colors.textSubtle}>
          We verify the account name with your bank. Withdrawals can only go to an account in your name.
        </Text>
        {addAccount.isError ? (
          <Text size={12} lineHeight={14.4} color={colors.error}>
            {addAccount.error.message}
          </Text>
        ) : null}
        <Button title="Add account" disabled={!bankCode.trim() || accountNumber.length !== 10} loading={addAccount.isPending} onPress={() => addAccount.mutate()} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({ content: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 40, gap: 16 } });
