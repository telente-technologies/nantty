"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { InlineNotice } from "@/components/ui/feedback";
import { TextField } from "@/components/ui/formFields";
import { OverlayDialog } from "@/components/ui/overlayDialog";
import { useToast } from "@/components/ui/toastProvider";
import { useAdsVerification } from "@/components/verification/adsVerificationProvider";
import { VerificationPrompt } from "@/components/verification/verificationPrompt";
import { AdsApiRequestError, grantStepUpWithPassword, isStepUpRequiredError, isVerificationRequiredError, readErrorMessageForDisplay } from "@/services/adsApiClient.service";
import { billingApi } from "@/services/billingApi.service";
import type { Money } from "@/types/money.type";
import { createClientIdempotencyKey } from "@/utils/formValidation.util";
import { formatMajorAmountForInput, formatMoneyForDisplay, parseTypedMajorAmountToMoney, readCurrencySymbol } from "@/utils/money.util";

interface PayFromBalanceDialogProps {
  readonly accountId: string;
  readonly accountCurrency: string;
  readonly availableToWithdraw: Money;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onPaid: () => void;
}

const knownErrorMessages: Record<string, string> = {
  INSUFFICIENT_FUNDS: "Amount is more than your available balance. Enter a smaller amount.",
  IDEMPOTENCY_KEY_REUSED: "This payment was already started with a different amount. Check your balance, then try again.",
  FORBIDDEN: "Only the owner of this ad account can pay from their Zudomart balance.",
};

function validateAmount(amount: Money | null, available: Money): string | undefined {
  if (!amount || amount.amountMinor <= 0) return "Enter an amount.";
  if (amount.amountMinor > available.amountMinor) return `You have ${formatMoneyForDisplay(available)} available to withdraw.`;
  return undefined;
}

export function PayFromBalanceDialog({ accountId, accountCurrency, availableToWithdraw, isOpen, onClose, onPaid }: PayFromBalanceDialogProps) {
  const { showToast } = useToast();
  const { needsVerification } = useAdsVerification();
  const [typedAmount, setTypedAmount] = useState(() => formatMajorAmountForInput(availableToWithdraw.amountMinor > 0 ? availableToWithdraw : null));
  const [showErrors, setShowErrors] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null);
  const attemptRef = useRef<{ key: string; amountMinor: number } | null>(null);
  const [stepUpNeeded, setStepUpNeeded] = useState(false);
  const [password, setPassword] = useState("");
  const isSameCurrency = availableToWithdraw.currency === accountCurrency;
  const amount = parseTypedMajorAmountToMoney(typedAmount, accountCurrency);
  const amountError = validateAmount(amount, availableToWithdraw);
  const cannotPay = needsVerification || !isSameCurrency || availableToWithdraw.amountMinor <= 0;

  async function payFromBalance() {
    setShowErrors(true);
    if (isPaying || cannotPay || amountError || !amount) return;
    if (stepUpNeeded && password.length === 0) {
      setErrorMessage("Enter your password to confirm this payment.");
      return;
    }
    if (attemptRef.current?.amountMinor !== amount.amountMinor) attemptRef.current = { key: createClientIdempotencyKey("fund"), amountMinor: amount.amountMinor };
    setIsPaying(true);
    setErrorMessage(null);
    setVerificationMessage(null);
    try {
      const stepUpToken = stepUpNeeded ? await grantStepUpWithPassword(password) : undefined;
      const funding = await billingApi.fundFromEarnings(accountId, amount, attemptRef.current.key, stepUpToken);
      attemptRef.current = null;
      setStepUpNeeded(false);
      setPassword("");
      showToast(`Added ${formatMoneyForDisplay(funding.amount)} from your Zudomart balance`);
      onPaid();
      onClose();
    } catch (error) {
      setPassword("");
      if (isStepUpRequiredError(error)) {
        setStepUpNeeded(true);
        setErrorMessage("For your safety, confirm larger payments from your balance with your password.");
        return;
      }
      if (isVerificationRequiredError(error)) setVerificationMessage(error.message);
      else setErrorMessage(error instanceof AdsApiRequestError ? (knownErrorMessages[error.code] ?? readErrorMessageForDisplay(error)) : readErrorMessageForDisplay(error));
      if (error instanceof AdsApiRequestError && error.status > 0 && error.status < 500) attemptRef.current = null;
      if (error instanceof AdsApiRequestError && error.code === "INSUFFICIENT_FUNDS") onPaid();
    } finally {
      setIsPaying(false);
    }
  }

  return (
    <OverlayDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Pay from my Zudomart balance"
      description="Move money you can withdraw into this ad account's balance. Ad balance cannot be withdrawn again."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" isLoading={isPaying} disabled={cannotPay} onClick={payFromBalance}>
            Pay{amount && !amountError ? ` ${formatMoneyForDisplay(amount)}` : ""}
          </Button>
        </>
      }
    >
      <p>
        Available to withdraw: <strong>{formatMoneyForDisplay(availableToWithdraw)}</strong>
      </p>
      {needsVerification || verificationMessage ? <VerificationPrompt message={verificationMessage} /> : null}
      {!isSameCurrency ? <InlineNotice tone="info">Your Zudomart balance is in {availableToWithdraw.currency} and this ad account bills in {accountCurrency}. Add funds by card instead.</InlineNotice> : null}
      {isSameCurrency && availableToWithdraw.amountMinor <= 0 && !needsVerification ? <InlineNotice tone="info">You have nothing available to withdraw yet. Add funds by card or bank transfer instead.</InlineNotice> : null}
      {!cannotPay ? (
        <TextField
          label="Amount"
          inputMode="decimal"
          autoComplete="off"
          prefix={readCurrencySymbol(accountCurrency)}
          value={typedAmount}
          onValueChange={setTypedAmount}
          error={showErrors ? amountError : undefined}
          hint={`Up to ${formatMoneyForDisplay(availableToWithdraw)}.`}
        />
      ) : null}
      {stepUpNeeded && !cannotPay ? (
        <TextField label="Your Zudomart password" type="password" autoComplete="current-password" value={password} onValueChange={setPassword} hint="We ask again before larger payments leave your balance." />
      ) : null}
      {errorMessage ? <InlineNotice tone="error">{errorMessage}</InlineNotice> : null}
    </OverlayDialog>
  );
}
