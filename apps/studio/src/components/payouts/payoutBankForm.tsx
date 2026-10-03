"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/field";
import { payoutOnboardingService } from "@/services/payoutOnboarding.service";
import type { PayoutOnboardingState } from "@/types/payoutOnboarding.type";
import { doPayoutNamesMatch } from "@/utils/payoutName.util";

import styles from "./payoutOnboarding.module.css";
import { PayoutStepFrame } from "./payoutStepFrame";

interface PayoutBankFormProps {
  readonly state: PayoutOnboardingState;
  readonly stepNumber: number;
  readonly stepCount: number;
  readonly onSaved: () => void;
}

export function PayoutBankForm({ state, stepNumber, stepCount, onSaved }: PayoutBankFormProps) {
  const banks = useQuery({ queryKey: ["payout-banks"], queryFn: payoutOnboardingService.listBanks });
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const isLookupReady = bankCode !== "" && accountNumber.length === 10;
  const resolved = useQuery({
    queryKey: ["payout-resolve", bankCode, accountNumber],
    queryFn: () => payoutOnboardingService.resolveAccountName(bankCode, accountNumber),
    enabled: isLookupReady,
    retry: false,
  });
  const resolvedName = isLookupReady ? resolved.data?.accountName ?? "" : "";
  const matches = doPayoutNamesMatch(resolvedName, state.legalName ?? "");
  const bankName = banks.data?.find((bank) => bank.code === bankCode)?.name ?? "";
  const save = useMutation({ mutationFn: () => payoutOnboardingService.saveBank({ bankCode, bankName, accountNumber, resolvedAccountName: resolvedName }), onSuccess: onSaved });

  return (
    <PayoutStepFrame stepNumber={stepNumber} stepCount={stepCount} title="Where to send your money" why="Payouts only go to a bank account in your own name. We check the account name with your bank so nothing is sent to the wrong person.">
      <div className={styles.grid}>
        <SelectField label="Bank" value={bankCode} onChange={(event) => setBankCode(event.target.value)}>
          <option value="">Choose your bank</option>
          {(banks.data ?? []).map((bank) => <option key={bank.code} value={bank.code}>{bank.name}</option>)}
        </SelectField>
        <TextField label="Account number" inputMode="numeric" maxLength={10} value={accountNumber} onChange={(event) => setAccountNumber(event.target.value.replace(/\D/g, ""))} />
      </div>
      {isLookupReady && resolved.isFetching ? <p className={styles.muted} role="status">Checking the account name…</p> : null}
      {isLookupReady && resolved.isError ? <p className={`${styles.notice} ${styles.noticeError}`} role="alert">{resolved.error.message}</p> : null}
      {resolvedName ? (
        <div className={styles.stack} aria-live="polite">
          <span className={styles.muted}>Account name</span>
          <span className={styles.resolvedName}>{resolvedName}</span>
          <p className={`${styles.notice} ${matches ? styles.noticeSuccess : styles.noticeError}`}>{matches ? "This matches your legal name." : `This does not match "${state.legalName}". Use an account in your own name, or go back and fix your legal name.`}</p>
        </div>
      ) : null}
      {save.isError ? <p className={`${styles.notice} ${styles.noticeError}`} role="alert">{save.error.message}</p> : null}
      <div className={styles.actions}><Button busy={save.isPending} disabled={!matches} onClick={() => save.mutate()}>Save account</Button></div>
    </PayoutStepFrame>
  );
}
