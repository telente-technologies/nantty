import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { BankPickerField } from "@/components/wallet/bankPickerSheet";
import { useTheme } from "@/theme";
import { banksService } from "@/services/commerce/banks.service";
import { payoutOnboardingService } from "@/services/commerce/payoutOnboarding.service";
import type { PayoutOnboardingState } from "@/types/payoutOnboarding.type";
import { payoutNamesMatch } from "@/utils/payoutName.util";

import { StepFrame } from "./stepFrame";

interface BankStepProps {
  readonly state: PayoutOnboardingState;
  readonly stepNumber: number;
  readonly stepCount: number;
  readonly onSaved: () => void;
}

export function BankStep({ state, stepNumber, stepCount, onSaved }: BankStepProps) {
  const { colors } = useTheme();
  const [bankCode, setBankCode] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const lookupReady = !!bankCode && accountNumber.length === 10;
  const resolved = useQuery({
    queryKey: ["payoutOnboarding", "resolve", bankCode, accountNumber],
    queryFn: () => banksService.resolveBankAccountName(bankCode, accountNumber),
    enabled: lookupReady,
    retry: false,
  });
  const resolvedName = lookupReady ? resolved.data?.accountName ?? "" : "";
  const matches = payoutNamesMatch(resolvedName, state.legalName ?? "");
  const save = useMutation({
    mutationFn: () => payoutOnboardingService.saveBank({ bankCode, bankName, accountNumber, resolvedAccountName: resolvedName }),
    onSuccess: onSaved,
  });

  return (
    <StepFrame
      stepNumber={stepNumber}
      stepCount={stepCount}
      title="Where to send your money"
      why="Payouts only go to a bank account in your own name. We check the account name with your bank so nothing is sent to the wrong person."
    >
      <BankPickerField selectedBankCode={bankCode} selectedBankName={bankName} onSelectBank={(bank) => { setBankCode(bank.code); setBankName(bank.name); }} />
      <TextField label="Account number" placeholder="10-digit account number" keyboardType="number-pad" maxLength={10} value={accountNumber} onChangeText={(value) => setAccountNumber(value.replace(/\D/g, ""))} />
      {lookupReady && resolved.isFetching ? (
        <View style={styles.row}>
          <ActivityIndicator color={colors.primary} />
          <Text size={13} lineHeight={16.9} color={colors.textMuted}>Checking the account name…</Text>
        </View>
      ) : null}
      {lookupReady && resolved.isError ? <Text size={13} lineHeight={18} color={colors.error}>{resolved.error.message}</Text> : null}
      {resolvedName ? (
        <View accessibilityLiveRegion="polite" style={{ gap: 4 }}>
          <Text size={12} lineHeight={14.4} color={colors.textMuted}>Account name</Text>
          <Text size={16} weight={600} lineHeight={19.2}>{resolvedName}</Text>
          <Text size={13} lineHeight={18} color={matches ? colors.successText : colors.error}>
            {matches ? "This matches your legal name." : `This doesn't match "${state.legalName}". Use an account in your own name, or go back and fix your legal name.`}
          </Text>
        </View>
      ) : null}
      {save.isError ? <Text size={12} lineHeight={14.4} color={colors.error}>{save.error.message}</Text> : null}
      <Button title="Save account" disabled={!matches} loading={save.isPending} onPress={() => save.mutate()} />
    </StepFrame>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: "row", alignItems: "center", gap: 8 } });
