"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/feedback";
import { SelectField, TextField } from "@/components/ui/formFields";
import { ModalDialog } from "@/components/ui/modalDialog";
import { KeyValueList } from "@/components/ui/panel";
import { readPayoutAccountNumberRuleForCountry } from "@/constants/walletBankRules.constant";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { useStoreContext } from "@/hooks/useStoreSettings.hook";
import { StepUpCancelledError, useStepUpPrompt } from "@/components/wallet/stepUpDialog";
import { stepUpHeaders } from "@/services/stepUp.service";
import { createIdempotencyKey, readErrorMessageForDisplay, sendSellerApiRequest, SellerApiRequestError } from "@/services/clientApi.service";
import type { CursorPage } from "@/types/pagination.type";
import type { PayoutAccount } from "@/types/wallet.type";
import type { ResolvedPayoutAccount, WalletBank, WalletBankBranch } from "@/types/walletExtra.type";

import styles from "./wallet.module.css";

export function AddPayoutAccountDialog({ isOpen, onClose, onAccountAdded }: { readonly isOpen: boolean; readonly onClose: () => void; readonly onAccountAdded: (account: PayoutAccount) => void }) {
  const { settings } = useStoreContext();
  const accountNumberRule = readPayoutAccountNumberRuleForCountry(settings?.country);
  const banksQuery = useSellerQuery<CursorPage<WalletBank>>(isOpen ? "/seller/wallet/banks" : null);
  const [bankCode, setBankCode] = useState("");
  const [branchCode, setBranchCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ bankCode?: string; branchCode?: string; accountNumber?: string }>({});
  const branchesQuery = useSellerQuery<CursorPage<WalletBankBranch>>(isOpen && bankCode ? `/seller/wallet/banks/${encodeURIComponent(bankCode)}/branches` : null);
  const [resolvedAccount, setResolvedAccount] = useState<ResolvedPayoutAccount | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const idempotencyKeyRef = useRef(createIdempotencyKey("payout_account"));
  const { withStepUp, stepUpDialog } = useStepUpPrompt();

  function resetDialogState() {
    setBankCode("");
    setBranchCode("");
    setAccountNumber("");
    setFieldErrors({});
    setResolvedAccount(null);
    setErrorMessage(null);
    idempotencyKeyRef.current = createIdempotencyKey("payout_account");
  }

  async function resolveAccountName() {
    const errors: { bankCode?: string; accountNumber?: string } = {};
    if (!bankCode) errors.bankCode = "Choose your bank.";
    if (branchesQuery.isLoading || branchesQuery.errorMessage) {
      setErrorMessage("Wait until the bank branch check succeeds before checking this account.");
      return;
    }
    if ((branchesQuery.data?.data ?? []).length > 0 && !branchCode) {
      setFieldErrors((current) => ({ ...current, branchCode: "Choose your bank branch." }));
      return;
    }
    if (!accountNumberRule.pattern.test(accountNumber.trim())) errors.accountNumber = `Enter a valid account number (${accountNumberRule.hint}).`;
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setIsWorking(true);
    setErrorMessage(null);
    try {
      setResolvedAccount(await sendSellerApiRequest<ResolvedPayoutAccount>("/seller/wallet/payout-accounts/resolve", { method: "POST", body: { bankCode, branchCode: branchCode || undefined, accountNumber: accountNumber.trim() } }));
    } catch (error) {
      if (error instanceof SellerApiRequestError && error.issues?.length) setFieldErrors(Object.fromEntries(error.issues.map((issue) => [issue.path, issue.message])));
      setErrorMessage(readErrorMessageForDisplay(error));
    } finally {
      setIsWorking(false);
    }
  }

  async function saveResolvedAccount() {
    if (!resolvedAccount) return;
    setIsWorking(true);
    setErrorMessage(null);
    try {
      const idempotencyKey = idempotencyKeyRef.current;
      const resolutionId = resolvedAccount.resolutionId;
      const account = await withStepUp((token) => sendSellerApiRequest<PayoutAccount>("/seller/wallet/payout-accounts", { method: "POST", body: { resolutionId }, idempotencyKey, headers: stepUpHeaders(token) }));
      resetDialogState();
      onAccountAdded(account);
    } catch (error) {
      if (!(error instanceof StepUpCancelledError)) setErrorMessage(readErrorMessageForDisplay(error));
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <>
    {stepUpDialog}
    <ModalDialog
      isOpen={isOpen}
      title="Add payout account"
      description="The account name must match your business or the store owner."
      onClose={() => {
        resetDialogState();
        onClose();
      }}
      width="small"
      footer={
        resolvedAccount ? (
          <>
            <Button onClick={() => setResolvedAccount(null)} disabled={isWorking}>
              Change details
            </Button>
            <Button variant="primary" onClick={() => void saveResolvedAccount()} isBusy={isWorking}>
              Save account
            </Button>
          </>
        ) : (
          <Button variant="primary" onClick={() => void resolveAccountName()} isBusy={isWorking} disabled={branchesQuery.isLoading || Boolean(branchesQuery.errorMessage) || ((branchesQuery.data?.data ?? []).length > 0 && !branchCode)}>
            Check account
          </Button>
        )
      }
    >
      <div className={styles.stack}>
        {resolvedAccount ? (
          <>
            <Callout tone="success" title="Account found">Confirm this is the right account before saving.</Callout>
            <KeyValueList items={[{ label: "Bank", value: resolvedAccount.bankName }, { label: "Account number", value: resolvedAccount.accountNumberMasked }, { label: "Account name", value: resolvedAccount.accountNameMasked }]} />
          </>
        ) : (
          <>
            <SelectField label="Bank" value={bankCode} onChange={(event) => { setBankCode(event.target.value); setBranchCode(""); }} errorMessage={fieldErrors.bankCode} options={[{ value: "", label: banksQuery.isLoading ? "Loading banks…" : "Choose a bank" }, ...(banksQuery.data?.data ?? []).map((bank) => ({ value: bank.code, label: bank.name }))]} />
            {branchesQuery.isLoading ? <p className={styles.muted}>Checking branch requirements…</p> : null}
            {branchesQuery.errorMessage ? <Callout tone="error">We couldn’t load this bank’s branch list. <button type="button" className={styles.inlineAction} onClick={branchesQuery.reload}>Try again</button> before checking the account.</Callout> : null}
            {(branchesQuery.data?.data ?? []).length > 0 ? (
              <SelectField label="Bank branch" value={branchCode} onChange={(event) => setBranchCode(event.target.value)} errorMessage={fieldErrors.branchCode} options={[{ value: "", label: "Choose a branch" }, ...(branchesQuery.data?.data ?? []).map((branch) => ({ value: branch.code, label: `${branch.name} · ${branch.code}` }))]} />
            ) : null}
            <TextField label={accountNumberRule.label} value={accountNumber} onChange={(event) => setAccountNumber(event.target.value.replace(/\s/g, ""))} inputMode="numeric" autoComplete="off" maxLength={34} hint={accountNumberRule.hint} errorMessage={fieldErrors.accountNumber} />
          </>
        )}
        {errorMessage ? <Callout tone="error">{errorMessage}</Callout> : null}
      </div>
    </ModalDialog>
    </>
  );
}
