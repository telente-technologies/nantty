"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/feedback";
import { TextField } from "@/components/ui/formFields";
import { ModalDialog } from "@/components/ui/modalDialog";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { PromotionCodeValidation } from "@/types/posExtra.type";

import styles from "./posDialogs.module.css";

export function PosCouponDialog({ isOpen, subtotalMinor, onApply, onClose }: { readonly isOpen: boolean; readonly subtotalMinor: number; readonly onApply: (coupon: PromotionCodeValidation) => void; readonly onClose: () => void }) {
  const [code, setCode] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  async function validateAndApplyCoupon() {
    const normalisedCode = code.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,40}$/.test(normalisedCode)) {
      setErrorMessage("Coupon codes are 3–40 letters, numbers, dashes or underscores.");
      return;
    }
    setIsChecking(true);
    setErrorMessage(null);
    try {
      const coupon = await sendSellerApiRequest<PromotionCodeValidation>("/seller/promotions/validate-code", { method: "POST", body: { code: normalisedCode, subtotalMinor, channel: "pos" } });
      onApply(coupon);
      setCode("");
    } catch (error) {
      setErrorMessage(readErrorMessageForDisplay(error));
    } finally {
      setIsChecking(false);
    }
  }

  return (
    <ModalDialog isOpen={isOpen} onClose={onClose} title="Apply a coupon" width="small" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" isBusy={isChecking} onClick={() => void validateAndApplyCoupon()}>Apply coupon</Button></>}>
      <form className={styles.formStack} onSubmit={(event) => { event.preventDefault(); void validateAndApplyCoupon(); }}>
        {errorMessage ? <Callout tone="error">{errorMessage}</Callout> : null}
        <TextField label="Coupon code" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} autoFocus maxLength={40} autoComplete="off" />
      </form>
    </ModalDialog>
  );
}
