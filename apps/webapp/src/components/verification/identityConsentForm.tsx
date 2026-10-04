"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import styles from "@/components/settings/settings.module.css";
import { identityVerificationService } from "@/services/identityVerification.service";
import { biometricConsentPoints, describeDocumentType } from "@/utils/identityVerificationCopy.util";

const countries = [["NG", "Nigeria"], ["GH", "Ghana"], ["KE", "Kenya"], ["ZA", "South Africa"], ["GB", "United Kingdom"], ["US", "United States"]] as const;

export function IdentityConsentForm({ busy, errorMessage, onStart }: { readonly busy: boolean; readonly errorMessage: string | null; readonly onStart: (choice: { documentCountry: string; documentType: string }) => void }) {
  const [accepted, setAccepted] = useState(false);
  const [country, setCountry] = useState("NG");
  const [documentType, setDocumentType] = useState("");
  const documents = useQuery({ queryKey: ["verification", "documentTypes", country], queryFn: () => identityVerificationService.listDocumentTypes(country) });

  return (
    <section className={styles.block} aria-labelledby="consent-heading">
      <h2 id="consent-heading" className={styles.blockHeading}>Before we check your identity</h2>
      <ul className={styles.bulletList}>{biometricConsentPoints.map((point) => <li key={point}>{point}</li>)}</ul>
      <label className={styles.radioRow}>
        <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
        <span>I agree to Smile ID processing my selfie and ID photo to verify my identity for Zudomart.</span>
      </label>
      <label className={styles.subHeading} htmlFor="id-country">Where was your ID issued?</label>
      <select id="id-country" value={country} onChange={(event) => { setCountry(event.target.value); setDocumentType(""); }}>
        {countries.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
      </select>
      <fieldset className={styles.radioGroup}>
        <legend className={styles.subHeading}>Which photo ID will you use?</legend>
        {(documents.data?.documentTypes ?? []).map((code) => (
          <label key={code} className={styles.radioRow}>
            <input type="radio" name="document-type" value={code} checked={documentType === code} onChange={() => setDocumentType(code)} />
            <span>{describeDocumentType(code)}</span>
          </label>
        ))}
      </fieldset>
      {documents.data?.governmentLookup ? <p className={styles.muted}>We&apos;ll also confirm your ID number with the government database.</p> : null}
      {errorMessage ? <p className={styles.errorText} role="alert">{errorMessage}</p> : null}
      <div className={styles.buttonRow}>
        <Button disabled={!accepted || !documentType} busy={busy} onClick={() => onStart({ documentCountry: country, documentType })}>Start selfie and ID check</Button>
      </div>
    </section>
  );
}
