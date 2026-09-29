"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { TextAreaField } from "@/components/ui/formFields";
import { ModalDialog } from "@/components/ui/modalDialog";
import { useToast } from "@/components/ui/toastProvider";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { OnlineOrder } from "@/types/order.type";

export function OrderCancelDialog({ order, isOpen, onClose, onCancelled }: { readonly order: OnlineOrder; readonly isOpen: boolean; readonly onClose: () => void; readonly onCancelled: (order: OnlineOrder) => void }) {
  const { showToast } = useToast();
  const [reason, setReason] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function cancelOrderAndRefundBuyer() {
    if (reason.trim().length < 5) {
      setErrorMessage("Tell the buyer why (at least 5 characters).");
      return;
    }
    setIsSubmitting(true);
    try {
      const cancelledOrder = await sendSellerApiRequest<OnlineOrder>(`/seller/orders/${order.id}/cancel`, { method: "POST", body: { reason: reason.trim() } });
      showToast(`Cancelled ${order.orderNumber}. The buyer's money is on its way back.`);
      onCancelled(cancelledOrder);
      onClose();
    } catch (error) {
      setErrorMessage(readErrorMessageForDisplay(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={onClose}
      title={`Cancel ${order.orderNumber}?`}
      description="The buyer gets a full refund from escrow. This cannot be undone."
      width="small"
      footer={
        <>
          <Button onClick={onClose}>Keep order</Button>
          <Button variant="danger" isBusy={isSubmitting} onClick={() => void cancelOrderAndRefundBuyer()}>
            Cancel and refund
          </Button>
        </>
      }
    >
      <TextAreaField label="Reason shown to the buyer" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} errorMessage={errorMessage} />
    </ModalDialog>
  );
}
