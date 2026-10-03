"use client";

import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/field";
import { payoutOnboardingService } from "@/services/payoutOnboarding.service";
import type { PayoutIdType, PayoutOnboardingState } from "@/types/payoutOnboarding.type";

import styles from "./payoutOnboarding.module.css";
import { PayoutStepFrame } from "./payoutStepFrame";

interface PayoutIdentityFormProps {
  readonly state: PayoutOnboardingState;
  readonly stepCount: number;
  readonly onSaved: () => void;
}

export function PayoutIdentityForm({ state, stepCount, onSaved }: PayoutIdentityFormProps) {
  const [legalName, setLegalName] = useState(state.legalName ?? "");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [idType, setIdType] = useState<PayoutIdType>(state.idType ?? "bvn");
  const [idNumber, setIdNumber] = useState("");
  const [registeredBusiness, setRegisteredBusiness] = useState(state.requiresBusinessStep);
  const save = useMutation({
    mutationFn: () => payoutOnboardingService.saveIdentity({ legalName: legalName.trim(), dateOfBirth, addressLine1: addressLine1.trim(), city: city.trim(), state: region.trim(), idType, idNumber, registeredBusiness }),
    onSuccess: onSaved,
  });
  const ready = legalName.trim() && /^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) && addressLine1.trim() && city.trim() && region.trim() && idNumber.length === 11;

  function submit(event: FormEvent) {
    event.preventDefault();
    save.mutate();
  }

  return (
    <PayoutStepFrame stepNumber={1} stepCount={stepCount} title="Who you are" why="Nigerian banks and regulators require us to confirm who receives money before we can send it. We only ask once, and the same details cover everything you earn on Zudomart.">
      <form className={styles.stack} onSubmit={submit} noValidate>
        <TextField label="Legal name" hint="As it appears on your ID" value={legalName} onChange={(event) => setLegalName(event.target.value)} autoComplete="name" />
        <div className={styles.grid}>
          <TextField label="Date of birth" placeholder="YYYY-MM-DD" maxLength={10} value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} />
          <TextField label="Home address" value={addressLine1} onChange={(event) => setAddressLine1(event.target.value)} autoComplete="address-line1" />
          <TextField label="City" value={city} onChange={(event) => setCity(event.target.value)} />
          <TextField label="State" value={region} onChange={(event) => setRegion(event.target.value)} />
        </div>
        <div className={styles.grid}>
          <SelectField label="ID to verify with" value={idType} onChange={(event) => setIdType(event.target.value as PayoutIdType)}>
            <option value="bvn">BVN</option>
            <option value="nin">NIN</option>
          </SelectField>
          <TextField label={`${idType.toUpperCase()} (11 digits)`} inputMode="numeric" maxLength={11} value={idNumber} onChange={(event) => setIdNumber(event.target.value.replace(/\D/g, ""))} />
        </div>
        {state.role !== "creator" ? (
          <label className={styles.muted}>
            <input type="checkbox" checked={registeredBusiness} onChange={(event) => setRegisteredBusiness(event.target.checked)} /> I also sell as a registered business
          </label>
        ) : null}
        <p className={styles.muted}>Your BVN or NIN is used once to confirm your name matches your bank account. Zudomart never shows it again, shares it with other users, or uses it for anything else. We keep only the last 4 digits.</p>
        {save.isError ? <p className={`${styles.notice} ${styles.noticeError}`} role="alert">{save.error.message}</p> : null}
        <div className={styles.actions}><Button type="submit" busy={save.isPending} disabled={!ready}>Save and continue</Button></div>
      </form>
    </PayoutStepFrame>
  );
}
