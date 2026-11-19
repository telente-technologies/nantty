"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import styles from "@/components/settings/settings.module.css";
import { identityVerificationService } from "@/services/identityVerification.service";
import type { IdentityCaptureChoice } from "@/types/identityVerification.type";
import { availableIdentityVerificationMethods, biometricConsentPoints, describeDocumentType, filterIdentityCountries, sortIdentityCountries } from "@/utils/identityVerificationCopy.util";

export function IdentityConsentForm({ busy, errorMessage, privacyPolicyUrl, onStart }: { readonly busy: boolean; readonly errorMessage: string | null; readonly privacyPolicyUrl: string; readonly onStart: (choice: IdentityCaptureChoice) => void }) {
  const [consentedSelection, setConsentedSelection] = useState("");
  const [country, setCountry] = useState("");
  const [countrySearch, setCountrySearch] = useState("");
  const [product, setProduct] = useState<IdentityCaptureChoice["verificationProduct"]>("document_verification");
  const [documentType, setDocumentType] = useState("");
  const [typeSearch, setTypeSearch] = useState("");
  const countries = useQuery({ queryKey: ["verification", "documentCountries"], queryFn: identityVerificationService.listDocumentCountries });
  const countryOptions = countries.isError ? [] : sortIdentityCountries(countries.data?.countries ?? []);
  const visibleCountryOptions = filterIdentityCountries(countryOptions, countrySearch);
  const selectedCountry = countryOptions.some((item) => item.code === country) ? country : "";
  const documents = useQuery({ queryKey: ["verification", "documentTypes", selectedCountry], queryFn: () => identityVerificationService.listDocumentTypes(selectedCountry), enabled: Boolean(selectedCountry) });
  const countryTypes = !documents.isError && documents.data?.country === selectedCountry ? documents.data : undefined;
  const methodOptions = availableIdentityVerificationMethods(countryTypes);
  const selectedOption = methodOptions.find((option) => option.verificationProduct === product);
  const activeOption = selectedOption ?? methodOptions[0];
  const activeProduct = activeOption?.verificationProduct ?? product;
  const activeMethod = activeOption?.verificationMethod ?? "document";
  const canUseDocuments = methodOptions.some((option) => option.verificationProduct === "document_verification");
  const canUseEnhancedDocuments = methodOptions.some((option) => option.verificationProduct === "enhanced_document_verification");
  const canUseIdNumber = methodOptions.some((option) => option.verificationProduct === "enhanced_kyc");
  const anyMethodAvailable = methodOptions.length > 0;
  const options = (activeOption?.types ?? []).map((item) => ({ code: item.code, name: describeDocumentType(item.code, item.name) })).sort((left, right) => left.name.localeCompare(right.name));
  const visibleOptions = options.filter(({ code, name }) => `${name} ${code}`.toLowerCase().includes(typeSearch.trim().toLowerCase()));
  const selectedDocumentType = options.some(({ code }) => code === documentType) ? documentType : "";
  const selectionKey = `${selectedCountry}:${activeProduct}:${selectedDocumentType}`;
  const accepted = consentedSelection === selectionKey;

  return (
    <section className={styles.block} aria-labelledby="consent-heading">
      <h2 id="consent-heading" className={styles.blockHeading}>Before we check your identity</h2>
      <ul className={styles.bulletList}>{biometricConsentPoints.map((point) => <li key={point}>{point}</li>)}</ul>
      <p className={styles.muted}><a href={privacyPolicyUrl} target="_blank" rel="noopener noreferrer">Read Nantty&apos;s privacy policy</a></p>
      <p className={styles.muted}>Choose the country that issued your ID. Nantty lists photo IDs and ID-number checks separately. Photo IDs come from Smile ID&apos;s worldwide supported-document catalog. Authority-check IDs are shown only after Smile confirms Nantty&apos;s account entitlement; ID-number checks are country-specific options configured for Nantty and also require Smile ID partner-account activation. If your ID is missing, contact support rather than choosing a different ID.</p>
      <label className={styles.subHeading} htmlFor="id-country">Which country is your ID from?</label>
      {countries.isLoading ? <p className={styles.muted} role="status">Loading available countries…</p> : null}
      {countries.data?.catalogSource === "preview" ? <p className={styles.muted} role="status">Preview options only. Live countries, ID types, and product availability are confirmed by Smile ID for Nantty&apos;s partner account.</p> : null}
      {countries.data?.idNumberVerificationStatus === "unavailable" ? <p className={styles.muted} role="status">ID-number checks are temporarily unavailable. You can still use any listed photo-ID method.</p> : null}
      {countries.isError ? <div><p className={styles.errorText} role="alert">We couldn&apos;t load supported countries. Refresh and try again.</p><Button variant="secondary" onClick={() => void countries.refetch()}>Retry</Button></div> : null}
      {!countries.isLoading && !countries.isError && countries.data?.countries.length === 0 ? <p className={styles.muted} role="status">Identity checks are not enabled for this Nantty account yet. Please try again later.</p> : null}
      {countryOptions.length ? <>
        <TextField label="Search available countries" value={countrySearch} onChange={(event) => {
          const value = event.target.value;
          setCountrySearch(value);
          const current = countryOptions.find((item) => item.code === country);
          if (current && !filterIdentityCountries([current], value).length) {
            setCountry("");
            setProduct("document_verification");
            setDocumentType("");
            setTypeSearch("");
          }
        }} placeholder="Search by country name or code" autoComplete="off" />
        <select id="id-country" value={selectedCountry} onChange={(event) => {
          const nextCountry = event.target.value;
          setCountry(nextCountry);
          setCountrySearch("");
          setProduct("document_verification");
          setDocumentType("");
          setTypeSearch("");
        }}>
        <option value="" disabled>Select the country that issued your ID</option>
        {visibleCountryOptions.map(({ code, name }) => <option key={code} value={code}>{name}</option>)}
        </select>
        {countrySearch.trim() && visibleCountryOptions.length === 0 ? <p className={styles.muted} role="status">No supported countries match that search.</p> : null}
      </> : null}
      {documents.isLoading ? <p className={styles.muted} role="status">Loading verification methods…</p> : null}
      {countryTypes?.catalogSource === "preview" ? <p className={styles.muted} role="status">These are sample ID options for preview; they do not confirm that Smile ID has enabled this check for Nantty.</p> : null}
      {documents.isError ? <div><p className={styles.errorText} role="alert">We couldn&apos;t load verification methods for this country. Try again later.</p><Button variant="secondary" onClick={() => void documents.refetch()}>Retry</Button></div> : null}
      {countryTypes && anyMethodAvailable ? <fieldset className={styles.radioGroup}>
        <legend className={styles.subHeading}>Choose a verification method</legend>
        {canUseDocuments ? <label className={styles.radioRow}><input type="radio" name="verification-method" checked={activeProduct === "document_verification"} onChange={() => { setProduct("document_verification"); setDocumentType(""); setTypeSearch(""); }} /><span>Selfie + photo of ID <small className={styles.muted}>Compare your selfie and ID photo.</small></span></label> : null}
        {canUseEnhancedDocuments ? <label className={styles.radioRow}><input type="radio" name="verification-method" checked={activeProduct === "enhanced_document_verification"} onChange={() => { setProduct("enhanced_document_verification"); setDocumentType(""); setTypeSearch(""); }} /><span>Selfie + photo ID with authority check <small className={styles.muted}>Smile ID checks eligible document details with the issuer.</small></span></label> : null}
        {canUseIdNumber ? <label className={styles.radioRow}><input type="radio" name="verification-method" checked={activeProduct === "enhanced_kyc"} onChange={() => { setProduct("enhanced_kyc"); setDocumentType(""); setTypeSearch(""); }} /><span>ID number (secure Smile ID check) <small className={styles.muted}>Enter the number on Smile ID&apos;s secure page; Nantty does not ask you to type it here.</small></span></label> : null}
      </fieldset> : null}
      {activeProduct === "enhanced_document_verification" ? <p className={styles.muted}>This option checks the document against the issuing authority. Only ID types enabled for Nantty&apos;s Smile ID account appear here.</p> : null}
      {countryTypes?.enhancedDocumentEntitlementStatus === "unavailable" ? <p className={styles.muted} role="status">We couldn&apos;t confirm which authority-check IDs are enabled right now. You can use another available method or try again later.</p> : null}
      {countryTypes?.idNumberVerificationStatus === "unavailable" ? <p className={styles.muted} role="status">ID-number checks are temporarily unavailable for this country. You can use another listed method or try again later.</p> : null}
      {countryTypes && anyMethodAvailable ? <fieldset className={styles.radioGroup}>
        <legend className={styles.subHeading}>{activeProduct === "enhanced_document_verification" ? "Select your authority-check ID type" : activeMethod === "document" ? "Select your photo ID type" : "Select your ID-number type"}</legend>
        <TextField label="Search available ID types" hideLabel value={typeSearch} onChange={(event) => setTypeSearch(event.target.value)} placeholder="Search ID types" autoComplete="off" />
        {visibleOptions.map(({ code, name }) => (
          <label key={code} className={styles.radioRow}>
          <input type="radio" name="document-type" value={code} checked={selectedDocumentType === code} onChange={() => setDocumentType(code)} />
            <span>{name || describeDocumentType(code)}</span>
          </label>
        ))}
        {options.length > 0 && visibleOptions.length === 0 ? <p className={styles.muted} role="status">No ID types match that search.</p> : null}
      </fieldset> : null}
      {countryTypes && !anyMethodAvailable ? <p className={styles.muted} role="status">No enabled Smile ID verification method is available for this country.</p> : null}
      {canUseIdNumber && activeMethod === "id_number" ? <p className={styles.muted}>ID-number options are country-specific. For example, Nigeria may offer NIN, NIN Slip, or Virtual NIN when enabled. You enter the number on Smile ID&apos;s secure page—not in Nantty. Only the checks configured for Nantty and available to its Smile ID partner account are shown.</p> : null}
      {anyMethodAvailable ? <label className={styles.radioRow}>
        <input type="checkbox" checked={accepted} onChange={(event) => setConsentedSelection(event.target.checked ? selectionKey : "")} />
        <span>{activeProduct === "enhanced_document_verification" ? "I agree to Smile ID processing my selfie and photo ID and checking the document details with the issuing authority for Nantty verification." : activeMethod === "id_number" ? "I agree to Smile ID checking the ID number I provide through its secure page for Nantty verification." : "I agree to Smile ID processing my selfie and photo ID for Nantty verification."}</span>
      </label> : null}
      {errorMessage ? <p className={styles.errorText} role="alert">{errorMessage}</p> : null}
      <div className={styles.buttonRow}>
        <Button disabled={!accepted || !selectedDocumentType || !options.some(({ code }) => code === selectedDocumentType)} busy={busy} onClick={() => onStart({ verificationMethod: activeMethod, verificationProduct: activeProduct, documentCountry: selectedCountry, documentType: selectedDocumentType })}>Continue to identity check</Button>
      </div>
    </section>
  );
}
