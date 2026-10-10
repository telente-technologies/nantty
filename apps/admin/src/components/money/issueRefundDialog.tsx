"use client";

import { useState } from "react";

import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { TextField } from "@/components/ui/formFields";
import { useToast } from "@/components/ui/toastProvider";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { createIdempotencyKey } from "@/services/adminApiClient.service";
import { issueManualRefund } from "@/services/moneyApi.service";
import type { OrderDetail } from "@/types/commerce.type";
import { formatMoneyForDisplay, parseTypedMajorAmountToMoney, readMinorUnitDigitsForCurrency } from "@/utils/formatting.util";

export function IssueRefundDialog({ order, isOpen, onClose, onRefunded }: { readonly order: OrderDetail; readonly isOpen: boolean; readonly onClose: () => void; readonly onRefunded: () => void }) {
  const { showToast } = useToast();
  const [typedAmount, setTypedAmount] = useState("");
  const [idempotencyKey] = useState(createIdempotencyKey);
  const mutation = useAdminMutation(issueManualRefund);
  const currency = order.refundable.currency;
  const amount = parseTypedMajorAmountToMoney(typedAmount, currency);
  const mustRefundInFull = order.escrow?.status === "released";
  const amountError = typedAmount && !amount ? `Enter an amount in ${currency} with at most ${readMinorUnitDigitsForCurrency(currency)} decimals.` : amount && amount.amountMinor > order.refundable.amountMinor ? `At most ${formatMoneyForDisplay(order.refundable)} can be refunded.` : amount && mustRefundInFull && amount.amountMinor !== order.refundable.amountMinor ? `Escrow was released, so refund the full ${formatMoneyForDisplay(order.refundable)}.` : null;
  const isAmountValid = amount !== null && amount.amountMinor > 0 && amount.amountMinor <= order.refundable.amountMinor && (!mustRefundInFull || amount.amountMinor === order.refundable.amountMinor);

  async function confirmRefund(reason: string) {
    if (!amount) return;
    const refund = await mutation.run({ orderId: order.id, amount, reason, idempotencyKey });
    if (refund) {
      showToast(`Refund of ${formatMoneyForDisplay(refund.amount)} issued for ${order.orderNumber}`);
      onRefunded();
      onClose();
    }
  }

  return (
    <ConfirmActionDialog
      isOpen={isOpen}
      title={`Refund order ${order.orderNumber}`}
      description={`Money goes back to @${order.buyer.username} through the original payment method. Refundable now: ${formatMoneyForDisplay(order.refundable)}.`}
      consequences={mustRefundInFull ? ["Escrow was already released, so only a full refund is allowed. It is clawed back from the seller."] : ["The refund comes out of escrow before the seller is paid.", "A full refund closes the order and stops auto-release."]}
      confirmLabel={isAmountValid && amount ? `Refund ${formatMoneyForDisplay(amount)}` : "Issue refund"}
      tone="danger"
      requiresStepUp
      isConfirmDisabled={!isAmountValid}
      isBusy={mutation.isRunning}
      errorMessage={mutation.errorMessage}
      onConfirm={confirmRefund}
      onClose={onClose}
    >
      <TextField label={`Amount (${currency})`} inputMode="decimal" placeholder={String(order.refundable.amountMinor / 10 ** readMinorUnitDigitsForCurrency(currency))} value={typedAmount} onChange={(event) => setTypedAmount(event.target.value)} error={amountError} hint="Type the amount in major units, for example 12500.50." />
    </ConfirmActionDialog>
  );
}
