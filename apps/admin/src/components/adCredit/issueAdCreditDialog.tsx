"use client";

import { useState } from "react";

import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { TextField } from "@/components/ui/formFields";
import { useToast } from "@/components/ui/toastProvider";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { useIdempotencyKeyPerSubmission } from "@/hooks/useIdempotencyKeyPerSubmission.hook";
import { issueAdCreditToUser } from "@/services/adCreditApi.service";
import { buildSubmissionSignature, convertExpiryDateInputToIsoEndOfDay, isCurrencyCodeShaped, isExpiryInTheFuture, isPositiveMoney } from "@/utils/adCredit.util";
import { formatDateOnly, formatMoneyForDisplay, parseTypedMajorAmountToMoney, readMinorUnitDigitsForCurrency } from "@/utils/formatting.util";

import { AdCreditUserPicker, type PickedAdCreditUser } from "./adCreditUserPicker";

export function IssueAdCreditDialog({ isOpen, onClose, onIssued }: { readonly isOpen: boolean; readonly onClose: () => void; readonly onIssued: () => void }) {
  const { showToast } = useToast();
  const [pickedUser, setPickedUser] = useState<PickedAdCreditUser | null>(null);
  const [typedCurrency, setTypedCurrency] = useState("");
  const [typedAmount, setTypedAmount] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const keyForSubmission = useIdempotencyKeyPerSubmission();
  const mutation = useAdminMutation(issueAdCreditToUser);
  const currency = (typedCurrency || pickedUser?.currency || "").trim().toUpperCase();
  const isCurrencyValid = isCurrencyCodeShaped(currency);
  const amount = isCurrencyValid ? parseTypedMajorAmountToMoney(typedAmount, currency) : null;
  const expiresAt = expiryDate ? convertExpiryDateInputToIsoEndOfDay(expiryDate) : null;
  const expiryError = expiryDate && (!expiresAt || !isExpiryInTheFuture(expiresAt)) ? "Pick a date after today, or leave it empty for no expiry." : null;
  const amountError = typedAmount && isCurrencyValid && !isPositiveMoney(amount) ? `Enter an amount above zero in ${currency} with at most ${readMinorUnitDigitsForCurrency(currency)} decimals.` : null;
  const canSubmit = !!pickedUser && isCurrencyValid && isPositiveMoney(amount) && !expiryError;

  function pickUser(user: PickedAdCreditUser | null) {
    setPickedUser(user);
    setTypedCurrency(user?.currency ?? "");
  }

  async function confirmIssue(reason: string) {
    if (!pickedUser || !isPositiveMoney(amount)) return;
    const idempotencyKey = keyForSubmission(buildSubmissionSignature([pickedUser.id, amount.amountMinor, amount.currency, expiresAt, reason]));
    const issued = await mutation.run({ userId: pickedUser.id, amount, expiresAt, reason, idempotencyKey });
    if (issued) {
      showToast(`Issued ${formatMoneyForDisplay(issued.amount)} ad credit to ${issued.username ? `@${issued.username}` : issued.userId}`);
      onIssued();
      onClose();
    }
  }

  return (
    <ConfirmActionDialog
      isOpen={isOpen}
      title="Issue ad credit"
      description="Ad credit is promotional. It can only be spent on ads and boosts, and it can never be withdrawn."
      consequences={[
        "It is spent before the user's own ad balance, soonest-expiring credit first.",
        expiresAt ? `Unspent credit is removed after ${formatDateOnly(expiresAt)}.` : "Without an expiry date the credit never expires.",
        "You can revoke the unspent remainder later.",
      ]}
      confirmLabel={canSubmit && amount ? `Issue ${formatMoneyForDisplay(amount)}` : "Issue credit"}
      requiresStepUp
      isConfirmDisabled={!canSubmit}
      isBusy={mutation.isRunning}
      errorMessage={mutation.errorMessage}
      onConfirm={confirmIssue}
      onClose={onClose}
    >
      <AdCreditUserPicker pickedUser={pickedUser} onPick={pickUser} />
      <TextField label="Currency" value={currency} onChange={(event) => setTypedCurrency(event.target.value.toUpperCase())} maxLength={3} hint="The user's ad account currency. Filled in from the user when you pick one." error={currency && !isCurrencyValid ? "Use a three-letter currency code." : null} autoComplete="off" />
      <TextField label={`Amount${isCurrencyValid ? ` (${currency})` : ""}`} inputMode="decimal" value={typedAmount} onChange={(event) => setTypedAmount(event.target.value)} error={amountError} hint="Type the amount in major units, for example 5000." disabled={!isCurrencyValid} />
      <TextField label="Expiry date (optional)" type="date" value={expiryDate} onChange={(event) => setExpiryDate(event.target.value)} error={expiryError} hint="Leave empty for credit that never expires." />
    </ConfirmActionDialog>
  );
}
