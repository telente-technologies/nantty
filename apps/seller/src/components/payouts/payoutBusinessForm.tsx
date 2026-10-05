"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/feedback";
import { SelectField, TextField } from "@/components/ui/formFields";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";

import styles from "./payoutOnboarding.module.css";
import { PayoutStepFrame } from "./payoutStepFrame";

export function PayoutBusinessForm({ stepCount, onSaved }: { readonly stepCount: number; readonly onSaved: () => void }) {
  const [cacNumber, setCacNumber] = useState("");
  const [businessType, setBusinessType] = useState("sole_proprietorship");
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setIsBusy(true);
    setErrorMessage(null);
    try {
      await sendSellerApiRequest("/payments/payout-onboarding/me/business", { method: "PUT", body: { cacNumber: cacNumber.trim().toUpperCase(), businessType } });
      onSaved();
    } catch (error) {
      setErrorMessage(readErrorMessageForDisplay(error));
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <PayoutStepFrame stepNumber={2} stepCount={stepCount} title="Your business" why="Registered businesses are paid against their CAC registration, so we can match your store to the company that receives the money.">
      <form className={styles.stack} onSubmit={submit} noValidate>
        <div className={styles.grid}>
          <TextField label="CAC registration number" placeholder="RC1234567 or BN1234567" value={cacNumber} onChange={(event) => setCacNumber(event.target.value)} />
          <SelectField label="Business type" value={businessType} onChange={(event) => setBusinessType(event.target.value)} options={[{ value: "sole_proprietorship", label: "Sole proprietorship" }, { value: "partnership", label: "Partnership" }, { value: "limited_company", label: "Limited company" }]} />
        </div>
        {errorMessage ? <Callout tone="error">{errorMessage}</Callout> : null}
        <div className={styles.actions}><Button type="submit" variant="primary" isBusy={isBusy} disabled={cacNumber.trim().length < 8}>Save and continue</Button></div>
      </form>
    </PayoutStepFrame>
  );
}
