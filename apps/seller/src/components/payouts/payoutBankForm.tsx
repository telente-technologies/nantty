"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/feedback";
import { SelectField, TextField } from "@/components/ui/formFields";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { CursorPage } from "@/types/pagination.type";
import type { PayoutOnboardingState } from "@/types/payoutOnboarding.type";
import type { WalletBank } from "@/types/walletExtra.type";
import { doPayoutNamesMatch } from "@/utils/payoutName.util";

import styles from "./payoutOnboarding.module.css";
import { PayoutStepFrame } from "./payoutStepFrame";

export function PayoutBankForm({ state, stepNumber, stepCount, onSaved }: { readonly state: PayoutOnboardingState; readonly stepNumber: number; readonly stepCount: number; readonly onSaved: () => void }) {
  const banks = useSellerQuery<CursorPage<WalletBank>>("/seller/wallet/banks");
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [resolvedName, setResolvedName] = useState("");
  const [isResolving, setIsResolving] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const bank = banks.data?.data.find((candidate) => candidate.code === bankCode);
  const matches = doPayoutNamesMatch(resolvedName, state.legalName ?? "");

  useEffect(() => {
    setResolvedName("");
    setErrorMessage(null);
    if (!bankCode || accountNumber.length !== 10) return;
    let cancelled = false;
    setIsResolving(true);
    sendSellerApiRequest<{ accountName: string }>("/payments/payout-onboarding/me/resolve", { method: "POST", body: { bankCode, accountNumber } })
      .then((result) => !cancelled && setResolvedName(result.accountName))
      .catch((error: unknown) => !cancelled && setErrorMessage(readErrorMessageForDisplay(error)))
      .finally(() => !cancelled && setIsResolving(false));
    return () => { cancelled = true; };
  }, [bankCode, accountNumber]);

  async function save() {
    setIsBusy(true);
    setErrorMessage(null);
    try {
      await sendSellerApiRequest("/payments/payout-onboarding/me/bank", { method: "PUT", body: { bankCode, bankName: bank?.name ?? "", accountNumber, resolvedAccountName: resolvedName } });
      onSaved();
    } catch (error) {
      setErrorMessage(readErrorMessageForDisplay(error));
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <PayoutStepFrame stepNumber={stepNumber} stepCount={stepCount} title="Where to send your money" why="Payouts only go to a bank account in your own name. We check the account name with your bank so nothing is sent to the wrong person.">
      <div className={styles.grid}>
        <SelectField label="Bank" value={bankCode} onChange={(event) => setBankCode(event.target.value)} options={[{ value: "", label: "Choose your bank" }, ...(banks.data?.data ?? []).map((item) => ({ value: item.code, label: item.name }))]} />
        <TextField label="Account number" inputMode="numeric" maxLength={10} value={accountNumber} onChange={(event) => setAccountNumber(event.target.value.replace(/\D/g, ""))} />
      </div>
      {isResolving ? <p className={styles.muted} role="status">Checking the account name…</p> : null}
      {resolvedName ? (
        <div className={styles.resolved} aria-live="polite">
          <span className={styles.muted}>Account name</span>
          <span className={styles.resolvedName}>{resolvedName}</span>
          <Callout tone={matches ? "success" : "caution"}>{matches ? "This matches your legal name." : `This does not match "${state.legalName}". Use an account in your own name, or go back and fix your legal name.`}</Callout>
        </div>
      ) : null}
      {errorMessage ? <Callout tone="error">{errorMessage}</Callout> : null}
      <div className={styles.actions}><Button variant="primary" isBusy={isBusy} disabled={!matches} onClick={() => void save()}>Save account</Button></div>
    </PayoutStepFrame>
  );
}
