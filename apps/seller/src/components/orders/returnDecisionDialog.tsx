"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { SelectField, TextAreaField, ToggleSwitch } from "@/components/ui/formFields";
import { ModalDialog } from "@/components/ui/modalDialog";
import { useToast } from "@/components/ui/toastProvider";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { useStoreContext } from "@/hooks/useStoreSettings.hook";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { ReturnRequest } from "@/types/order.type";

export type ReturnDecision = "approve" | "decline" | "receive";

const decisionCopy: Record<ReturnDecision, { title: string; confirm: string; done: string }> = {
  approve: { title: "Approve this return?", confirm: "Approve return", done: "Return approved. The buyer will send the item back." },
  decline: { title: "Decline this return?", confirm: "Decline return", done: "Return declined. The buyer has been told why." },
  receive: { title: "Confirm you received the item", confirm: "Mark received and refund", done: "Item received and the buyer refunded." },
};

export function ReturnDecisionDialog({ returnRequest, decision, onClose, onDecided }: { readonly returnRequest: ReturnRequest | null; readonly decision: ReturnDecision; readonly onClose: () => void; readonly onDecided: (updated: ReturnRequest) => void }) {
  const { showToast } = useToast();
  const { formatMoney } = useMoneyFormatter();
  const { locations, selectedLocationId } = useStoreContext();
  const [note, setNote] = useState("");
  const [shouldRestock, setShouldRestock] = useState(true);
  const [restockLocationId, setRestockLocationId] = useState(selectedLocationId ?? "");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const copy = decisionCopy[decision];

  async function submitReturnDecision() {
    if (!returnRequest) return;
    if (decision === "decline" && note.trim().length < 5) {
      setErrorMessage("Tell the buyer why you are declining (at least 5 characters).");
      return;
    }
    if (decision === "receive" && shouldRestock && !restockLocationId) {
      setErrorMessage("Choose where to put the items back.");
      return;
    }
    setIsSubmitting(true);
    try {
      const updated = await sendSellerApiRequest<ReturnRequest>(`/seller/returns/${returnRequest.id}/${decision}`, {
        method: "POST",
        body: decision === "decline" ? { note: note.trim() } : decision === "receive" ? { restock: shouldRestock, locationId: shouldRestock ? restockLocationId : null } : {},
      });
      showToast(copy.done);
      onDecided(updated);
      onClose();
    } catch (error) {
      setErrorMessage(readErrorMessageForDisplay(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ModalDialog intent="refund"
      isOpen={returnRequest !== null}
      onClose={onClose}
      title={copy.title}
      description={returnRequest ? `${returnRequest.orderNumber} · ${returnRequest.buyerName} · refund ${formatMoney(returnRequest.refundAmount)}` : undefined}
      width="small"
      footer={
        <>
          <Button onClick={onClose}>Back</Button>
          <Button variant={decision === "decline" ? "danger" : "primary"} isBusy={isSubmitting} onClick={() => void submitReturnDecision()}>
            {copy.confirm}
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {returnRequest ? <p>Reason given: “{returnRequest.reason}”</p> : null}
        {decision === "decline" ? <TextAreaField label="Message to the buyer" value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} /> : null}
        {decision === "receive" ? (
          <>
            <ToggleSwitch label="Put the items back in stock" description="Turn off if the item is damaged." checked={shouldRestock} onCheckedChange={setShouldRestock} />
            {shouldRestock ? <SelectField label="Restock at" value={restockLocationId} onChange={(event) => setRestockLocationId(event.target.value)} options={[{ value: "", label: "Choose a location" }, ...locations.filter((location) => location.active).map((location) => ({ value: location.id, label: location.name }))]} /> : null}
          </>
        ) : null}
        {errorMessage ? <p role="alert" style={{ color: "var(--error-ink)", fontWeight: 500 }}>{errorMessage}</p> : null}
      </div>
    </ModalDialog>
  );
}
