"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { MoneyField, TextAreaField } from "@/components/ui/formFields";
import { ModalDialog } from "@/components/ui/modalDialog";
import { SegmentedControl } from "@/components/ui/navigationTabs";
import { useToast } from "@/components/ui/toastProvider";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { createIdempotencyKey, readErrorMessageForDisplay, sendSellerApiRequest, SellerApiRequestError } from "@/services/clientApi.service";
import type { OnlineOrder } from "@/types/order.type";
import { convertMajorInputToMinorUnits, convertMinorUnitsToMajorInputText } from "@/utils/money.util";

export function OrderRefundDialog({ order, isOpen, onClose, onRefunded }: { readonly order: OnlineOrder; readonly isOpen: boolean; readonly onClose: () => void; readonly onRefunded: (order: OnlineOrder) => void }) {
  const { showToast } = useToast();
  const { formatMoney } = useMoneyFormatter();
  const refundableMinor = order.total.amountMinor - order.refundedAmount.amountMinor;
  const [refundKind, setRefundKind] = useState<"full" | "partial">("full");
  const [amountText, setAmountText] = useState(convertMinorUnitsToMajorInputText(refundableMinor, order.total.currency));
  const [reason, setReason] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => createIdempotencyKey("refund"));

  async function sendRefundToBuyer() {
    const amountMinor = refundKind === "full" ? refundableMinor : convertMajorInputToMinorUnits(amountText, order.total.currency);
    const errors: Record<string, string> = {};
    if (amountMinor === null || amountMinor <= 0) errors.amountMinor = "Enter an amount above zero.";
    else if (amountMinor > refundableMinor) errors.amountMinor = `You can refund up to ${formatMoney({ amountMinor: refundableMinor, currency: order.total.currency })}.`;
    if (reason.trim().length < 5) errors.reason = "Tell the buyer why (at least 5 characters).";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0 || amountMinor === null) return;
    setIsSubmitting(true);
    try {
      const refundedOrder = await sendSellerApiRequest<OnlineOrder>(`/seller/orders/${order.id}/refunds`, { method: "POST", idempotencyKey, body: { amountMinor, reason: reason.trim() } });
      showToast(`Refund of ${formatMoney({ amountMinor, currency: order.total.currency })} sent to ${order.buyer.name}.`);
      setIdempotencyKey(createIdempotencyKey("refund"));
      onRefunded(refundedOrder);
      onClose();
    } catch (error) {
      if (error instanceof SellerApiRequestError && error.issues && error.issues.length > 0) setFieldErrors(Object.fromEntries(error.issues.map((issue) => [issue.path, issue.message])));
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ModalDialog intent="refund"
      isOpen={isOpen}
      onClose={onClose}
      width="small"
      title={`Refund ${order.orderNumber}`}
      description={`The money goes back to the buyer's original payment method. Up to ${formatMoney({ amountMinor: refundableMinor, currency: order.total.currency })} can still be refunded.`}
      footer={
        <>
          <Button onClick={onClose}>Not now</Button>
          <Button variant="danger" isBusy={isSubmitting} onClick={() => void sendRefundToBuyer()}>
            Send refund
          </Button>
        </>
      }
    >
      <SegmentedControl label="Refund amount" value={refundKind} onValueChange={setRefundKind} options={[{ value: "full", label: "Full refund" }, { value: "partial", label: "Partial refund" }]} />
      {refundKind === "partial" ? <MoneyField label="Amount to refund" currency={order.total.currency} valueText={amountText} onValueTextChange={setAmountText} errorMessage={fieldErrors.amountMinor} /> : null}
      {refundKind === "full" && fieldErrors.amountMinor ? <p role="alert">{fieldErrors.amountMinor}</p> : null}
      <TextAreaField label="Reason shown to the buyer" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} errorMessage={fieldErrors.reason} />
    </ModalDialog>
  );
}
