import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { TextField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { BankPickerField } from "@/components/wallet/bankPickerSheet";
import { useTheme } from "@/theme";
import { banksService } from "@/services/commerce/banks.service";

import type { ApplicationStepProps } from "./applicationStoreAndContactSteps";

export function ApplicationPayoutStep({ draft, onChange }: ApplicationStepProps) {
  const { colors } = useTheme();
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  useEffect(() => {
    if (!draft.payoutBankCode || draft.payoutAccountNumber.length !== 10) return;
    let cancelled = false;
    setResolving(true);
    setResolveError(null);
    banksService
      .resolveBankAccountName(draft.payoutBankCode, draft.payoutAccountNumber)
      .then(({ accountName }) => !cancelled && onChange({ payoutAccountName: accountName }))
      .catch((error: Error) => !cancelled && setResolveError(error.message))
      .finally(() => !cancelled && setResolving(false));
    return () => {
      cancelled = true;
    };
  }, [draft.payoutBankCode, draft.payoutAccountNumber]);

  return (
    <View style={styles.fields}>
      <BankPickerField
        selectedBankCode={draft.payoutBankCode}
        selectedBankName={draft.payoutBankName}
        onSelectBank={(bank) => onChange({ payoutBankCode: bank.code, payoutBankName: bank.name, payoutAccountName: "" })}
      />
      <TextField
        label="Account number"
        placeholder="10-digit account number"
        keyboardType="number-pad"
        maxLength={10}
        value={draft.payoutAccountNumber}
        onChangeText={(value) => onChange({ payoutAccountNumber: value.replace(/\D/g, ""), payoutAccountName: "" })}
      />
      <View style={styles.accountName} accessibilityLiveRegion="polite">
        {resolving ? <ActivityIndicator color={colors.primary} /> : null}
        {draft.payoutAccountName ? (
          <Text size={14} weight={500} lineHeight={16.8} color={colors.success}>{draft.payoutAccountName}</Text>
        ) : resolveError ? (
          <Text size={13} lineHeight={16.9} color={colors.error}>{resolveError}</Text>
        ) : (
          <Text size={12} lineHeight={16.8} color={colors.textSubtle}>We'll confirm the account name with your bank.</Text>
        )}
      </View>
      <Text size={12} lineHeight={16.8} color={colors.textMuted}>
        Escrow releases and withdrawals go to this account. The account name must match the name on your ID.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({ fields: { gap: 16 }, accountName: { minHeight: 24, flexDirection: "row", alignItems: "center", gap: 8 } });
