"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/feedback";
import { SelectField, TextField, ToggleSwitch } from "@/components/ui/formFields";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { PayoutOnboardingState } from "@/types/payoutOnboarding.type";

import styles from "./payoutOnboarding.module.css";
import { PayoutStepFrame } from "./payoutStepFrame";

export function PayoutIdentityForm({ state, stepCount, onSaved }: { readonly state: PayoutOnboardingState; readonly stepCount: number; readonly onSaved: () => void }) {
  const [legalName, setLegalName] = useState(state.legalName ?? "");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [idType, setIdType] = useState(state.idType ?? "bvn");
  const [idNumber, setIdNumber] = useState("");
  const [registeredBusiness, setRegisteredBusiness] = useState(state.requiresBusinessStep);
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const ready = legalName.trim() && /^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) && addressLine1.trim() && city.trim() && region.trim() && idNumber.length === 11;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setIsBusy(true);
    setErrorMessage(null);
    try {
      await sendSellerApiRequest("/payments/payout-onboarding/me/identity", { method: "PUT", body: { legalName: legalName.trim(), dateOfBirth, addressLine1: addressLine1.trim(), city: city.trim(), state: region.trim(), idType, idNumber, registeredBusiness } });
      onSaved();
    } catch (error) {
      setErrorMessage(readErrorMessageForDisplay(error));
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <PayoutStepFrame stepNumber={1} stepCount={stepCount} title="Who you are" why="Nigerian banks and regulators require us to confirm who receives money before we can send it. We only ask once, and the same details cover everything you earn on Nantty.">
      <form className={styles.stack} onSubmit={submit} noValidate>
        <TextField label="Legal name" hint="As it appears on your ID" value={legalName} onChange={(event) => setLegalName(event.target.value)} autoComplete="name" />
        <div className={styles.grid}>
          <TextField label="Date of birth" placeholder="YYYY-MM-DD" maxLength={10} value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} />
          <TextField label="Home address" value={addressLine1} onChange={(event) => setAddressLine1(event.target.value)} autoComplete="address-line1" />
          <TextField label="City" value={city} onChange={(event) => setCity(event.target.value)} />
          <TextField label="State" value={region} onChange={(event) => setRegion(event.target.value)} />
        </div>
        <div className={styles.grid}>
          <SelectField label="ID to verify with" value={idType} onChange={(event) => setIdType(event.target.value as "bvn" | "nin")} options={[{ value: "bvn", label: "BVN" }, { value: "nin", label: "NIN" }]} />
          <TextField label={`${idType.toUpperCase()} (11 digits)`} inputMode="numeric" maxLength={11} value={idNumber} onChange={(event) => setIdNumber(event.target.value.replace(/\D/g, ""))} />
        </div>
        {state.role !== "creator" ? <ToggleSwitch label="I sell as a registered business" description="You will add your CAC details next." checked={registeredBusiness} onCheckedChange={setRegisteredBusiness} /> : null}
        <p className={styles.muted}>Your ID number is sent securely to our payment partner for verification. Nantty never shows it again, shares it with other users, or uses it for anything else. We keep only the last 4 digits.</p>
        {errorMessage ? <Callout tone="error">{errorMessage}</Callout> : null}
        <div className={styles.actions}><Button type="submit" variant="primary" isBusy={isBusy} disabled={!ready}>Save and continue</Button></div>
      </form>
    </PayoutStepFrame>
  );
}
