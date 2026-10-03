"use client";

import { useState } from "react";

import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { TextField } from "@/components/ui/formFields";
import { useToast } from "@/components/ui/toastProvider";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { createIdempotencyKey } from "@/services/adminApiClient.service";
import { resolveDispute, type ResolveDisputeInput } from "@/services/moneyApi.service";
import type { Money } from "@/types/api.type";
import type { DisputeDetail, DisputeOutcome } from "@/types/commerce.type";
import { formatBasisPointsAsPercent, formatMoneyForDisplay, parseTypedMajorAmountToMoney, readMinorUnitDigitsForCurrency } from "@/utils/formatting.util";

import styles from "./money.module.css";

const outcomeOptions: readonly { value: DisputeOutcome; label: string; description: string }[] = [
  { value: "REFUND_FULL", label: "Refund the buyer in full", description: "Everything in escrow goes back to the buyer. The seller gets nothing." },
  { value: "REFUND_PARTIAL", label: "Partial refund", description: "Part goes back to the buyer, the rest is released to the seller." },
  { value: "RELEASE_TO_SELLER", label: "Release to seller", description: "The buyer's claim is not upheld. Escrow is released to the seller." },
];

export function calculateDisputeSplit(escrow: Money, refundMinor: number, commissionBasisPoints: number) {
  const sellerPortionMinor = Math.max(0, escrow.amountMinor - refundMinor);
  const commissionMinor = Math.round((sellerPortionMinor * commissionBasisPoints) / 10_000);
  return {
    buyerRefund: { amountMinor: refundMinor, currency: escrow.currency },
    sellerPayout: { amountMinor: sellerPortionMinor - commissionMinor, currency: escrow.currency },
    commission: { amountMinor: commissionMinor, currency: escrow.currency },
  };
}

export function ResolveDisputeDialog({ dispute, onClose, onResolved }: { readonly dispute: DisputeDetail; readonly onClose: () => void; readonly onResolved: (updated: DisputeDetail) => void }) {
  const { showToast } = useToast();
  const [outcome, setOutcome] = useState<DisputeOutcome>("REFUND_PARTIAL");
  const [typedAmount, setTypedAmount] = useState("");
  const [idempotencyKey] = useState(createIdempotencyKey);
  const mutation = useAdminMutation((input: ResolveDisputeInput) => resolveDispute(dispute.id, input));
  const escrow = dispute.escrow.heldAmount;
  const typedRefund = parseTypedMajorAmountToMoney(typedAmount, escrow.currency);
  const refundMinor = outcome === "REFUND_FULL" ? escrow.amountMinor : outcome === "RELEASE_TO_SELLER" ? 0 : (typedRefund?.amountMinor ?? 0);
  const isPartialValid = typedRefund !== null && typedRefund.amountMinor > 0 && typedRefund.amountMinor < escrow.amountMinor;
  const partialError = outcome !== "REFUND_PARTIAL" || !typedAmount ? null : !typedRefund ? `Enter an amount in ${escrow.currency}.` : !isPartialValid ? `Must be more than zero and less than ${formatMoneyForDisplay(escrow)}.` : null;
  const split = calculateDisputeSplit(escrow, refundMinor, dispute.commissionBasisPoints);

  async function confirmResolution(reason: string) {
    const updated = await mutation.run({ outcome, reason, idempotencyKey, refundAmount: outcome === "REFUND_PARTIAL" && typedRefund ? typedRefund : undefined });
    if (updated) {
      showToast(`Dispute ${dispute.id} resolved`);
      onResolved(updated);
      onClose();
    }
  }

  return (
    <ConfirmActionDialog
      isOpen
      title={`Resolve dispute ${dispute.id}`}
      description={`Order ${dispute.orderNumber}. ${formatMoneyForDisplay(escrow)} is held in escrow. This moves real money and cannot be undone here.`}
      confirmLabel="Resolve dispute"
      tone="danger"
      requiresStepUp
      reasonLabel="Decision note for buyer, seller and audit log"
      isConfirmDisabled={outcome === "REFUND_PARTIAL" && !isPartialValid}
      isBusy={mutation.isRunning}
      errorMessage={mutation.errorMessage}
      onConfirm={confirmResolution}
      onClose={onClose}
    >
      <fieldset className={styles.outcomeOptions}>
        <legend className="visuallyHidden">Outcome</legend>
        {outcomeOptions.map((option) => (
          <label key={option.value} className={styles.outcomeOption}>
            <input type="radio" name="dispute-outcome" value={option.value} checked={outcome === option.value} onChange={() => setOutcome(option.value)} />
            <span className={styles.stack}>
              <strong>{option.label}</strong>
              <span className={styles.muted}>{option.description}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {outcome === "REFUND_PARTIAL" ? (
        <TextField label={`Refund to buyer (${escrow.currency})`} inputMode="decimal" value={typedAmount} onChange={(event) => setTypedAmount(event.target.value)} error={partialError} hint={`Major units with up to ${readMinorUnitDigitsForCurrency(escrow.currency)} decimals.`} autoFocus />
      ) : null}
      <div className={styles.splitPreview} aria-live="polite">
        <div className={styles.splitCell}>
          <span className={styles.muted}>Buyer gets back</span>
          <strong>{formatMoneyForDisplay(split.buyerRefund)}</strong>
        </div>
        <div className={styles.splitCell}>
          <span className={styles.muted}>Seller receives</span>
          <strong>{formatMoneyForDisplay(split.sellerPayout)}</strong>
        </div>
        <div className={styles.splitCell}>
          <span className={styles.muted}>Escrow fee ({formatBasisPointsAsPercent(dispute.commissionBasisPoints)})</span>
          <strong>{formatMoneyForDisplay(split.commission)}</strong>
        </div>
      </div>
    </ConfirmActionDialog>
  );
}
