"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { InlineNotice } from "@/components/ui/feedback";
import { TextField } from "@/components/ui/formFields";
import { OverlayDialog } from "@/components/ui/overlayDialog";
import { billingApi } from "@/services/billingApi.service";
import { readErrorMessageForDisplay } from "@/services/adsApiClient.service";
import type { BillingOverview } from "@/types/billing.type";
import type { Money } from "@/types/money.type";
import { createClientIdempotencyKey } from "@/utils/formValidation.util";
import { formatMajorAmountForInput, formatMoneyForDisplay, parseTypedMajorAmountToMoney, readCurrencySymbol } from "@/utils/money.util";

import { openPaystackCheckoutIfSafe } from "./hostedCheckout.util";
import styles from "./billingPage.module.css";

interface TopUpDialogProps {
  readonly accountId: string;
  readonly overview: BillingOverview;
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

function validateTopUpAmount(amount: Money | null, overview: BillingOverview): string | undefined {
  if (!amount || amount.amountMinor <= 0) return "Enter an amount.";
  if (amount.amountMinor < overview.minimumTopUp.amountMinor) return `The minimum top-up is ${formatMoneyForDisplay(overview.minimumTopUp)}.`;
  if (amount.amountMinor > overview.maximumTopUp.amountMinor) return `The maximum top-up is ${formatMoneyForDisplay(overview.maximumTopUp)}.`;
  return undefined;
}

export function TopUpDialog({ accountId, overview, isOpen, onClose }: TopUpDialogProps) {
  const currency = overview.balance.currency;
  const [typedAmount, setTypedAmount] = useState(() => formatMajorAmountForInput(overview.suggestedTopUps[1] ?? overview.suggestedTopUps[0] ?? null));
  const [idempotencyKey] = useState(() => createClientIdempotencyKey("topup"));
  const [showErrors, setShowErrors] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const amount = parseTypedMajorAmountToMoney(typedAmount, currency);
  const amountError = validateTopUpAmount(amount, overview);

  async function startHostedCheckoutForTopUp() {
    setShowErrors(true);
    if (amountError || !amount) return;
    setIsStarting(true);
    setErrorMessage(null);
    try {
      const checkout = await billingApi.startTopUpCheckout(accountId, amount, "paystack", idempotencyKey);
      if (!(await openPaystackCheckoutIfSafe(checkout, `/accounts/${accountId}/billing/return?reference=${encodeURIComponent(checkout.reference)}`))) {
        setErrorMessage("The payment page address was not recognised, so we did not open it. Contact support.");
        setIsStarting(false);
      }
    } catch (error) {
      setErrorMessage(readErrorMessageForDisplay(error));
      setIsStarting(false);
    }
  }

  return (
    <OverlayDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Add funds"
      description={`Funds are added in ${currency}, the currency of this ad account.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" isLoading={isStarting} onClick={startHostedCheckoutForTopUp}>
            Continue to payment{amount && !amountError ? ` · ${formatMoneyForDisplay(amount)}` : ""}
          </Button>
        </>
      }
    >
      <div className={styles.chipRow} role="group" aria-label="Suggested amounts">
        {overview.suggestedTopUps.map((suggestion) => {
          const isSelected = amount?.amountMinor === suggestion.amountMinor;
          return (
            <button key={suggestion.amountMinor} type="button" aria-pressed={isSelected} className={isSelected ? `${styles.amountChip} ${styles.amountChipSelected}` : styles.amountChip} onClick={() => setTypedAmount(formatMajorAmountForInput(suggestion))}>
              {formatMoneyForDisplay(suggestion, { showMinorUnits: false })}
            </button>
          );
        })}
      </div>
      <TextField
        label="Amount"
        inputMode="decimal"
        autoComplete="off"
        prefix={readCurrencySymbol(currency)}
        value={typedAmount}
        onValueChange={setTypedAmount}
        error={showErrors ? amountError : undefined}
        hint={`Between ${formatMoneyForDisplay(overview.minimumTopUp)} and ${formatMoneyForDisplay(overview.maximumTopUp)}.`}
      />
      <InlineNotice tone="info">Pay by card, bank transfer or USSD in Paystack&apos;s secure window. We never see your card number.</InlineNotice>
      {errorMessage ? <InlineNotice tone="error">{errorMessage}</InlineNotice> : null}
    </OverlayDialog>
  );
}
