"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/feedback";
import { MoneyField, TextField } from "@/components/ui/formFields";
import { ModalDialog } from "@/components/ui/modalDialog";
import { createIdempotencyKey, readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { CurrencyCode } from "@/types/money.type";
import type { PosShift } from "@/types/pos.type";
import { convertMajorInputToMinorUnits } from "@/utils/money.util";

import styles from "./posDialogs.module.css";

export function PosCashMovementDialog({ kind, shiftId, currency, onSaved, onClose }: { readonly kind: "pay_in" | "pay_out" | null; readonly shiftId: string; readonly currency: CurrencyCode; readonly onSaved: (shift: PosShift) => void; readonly onClose: () => void }) {
  const [amountText, setAmountText] = useState("");
  const [reason, setReason] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => createIdempotencyKey("cash"));

  async function saveCashMovement() {
    const amountMinor = convertMajorInputToMinorUnits(amountText, currency);
    if (!amountMinor || amountMinor <= 0) return setErrorMessage("Enter an amount above zero.");
    if (reason.trim().length < 3) return setErrorMessage("Say why the cash is moving (at least 3 characters).");
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const shift = await sendSellerApiRequest<PosShift>(`/seller/pos/shifts/${encodeURIComponent(shiftId)}/cash-movements`, { method: "POST", body: { kind, amountMinor, reason: reason.trim() }, idempotencyKey });
      setAmountText("");
      setReason("");
      setIdempotencyKey(createIdempotencyKey("cash"));
      onSaved(shift);
    } catch (error) {
      setErrorMessage(readErrorMessageForDisplay(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ModalDialog isOpen={kind !== null} onClose={onClose} title={kind === "pay_in" ? "Pay cash in" : "Pay cash out"} description={kind === "pay_in" ? "For example, extra change added to the drawer." : "For example, buying fuel or paying a delivery rider."} width="small" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" isBusy={isSaving} onClick={() => void saveCashMovement()}>Save</Button></>}>
      <form className={styles.formStack} onSubmit={(event) => { event.preventDefault(); void saveCashMovement(); }}>
        {errorMessage ? <Callout tone="error">{errorMessage}</Callout> : null}
        <MoneyField label="Amount" currency={currency} valueText={amountText} onValueTextChange={setAmountText} autoFocus />
        <TextField label="Reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={200} />
      </form>
    </ModalDialog>
  );
}
