"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { InlineNotice } from "@/components/ui/feedback";
import { SegmentedControl, SelectField, TextAreaField, TextField } from "@/components/ui/formFields";
import { OverlayDialog } from "@/components/ui/overlayDialog";
import { supportedAccountCountries } from "@/constants/locale.constant";
import { audiencesApi } from "@/services/audiencesApi.service";
import { readErrorMessageForDisplay } from "@/services/adsApiClient.service";
import { maximumCustomerListRows, normalizeAndHashCustomerIdentifiersInBrowser, splitCustomerListTextIntoValues, type HashedCustomerListResult } from "@/services/customerListHashing.service";
import type { CustomAudience, HashedIdentifierType } from "@/types/audience.type";
import { createClientIdempotencyKey } from "@/utils/formValidation.util";
import { formatWholeCount } from "@/utils/numberFormatting.util";

import styles from "./audiencesPage.module.css";

const maximumFileBytes = 5 * 1024 * 1024;

interface CustomerListUploadDialogProps {
  readonly accountId: string;
  readonly defaultCountryCode: string;
  readonly onClose: () => void;
  readonly onCreated: (audience: CustomAudience) => void;
}

export function CustomerListUploadDialog({ accountId, defaultCountryCode, onClose, onCreated }: CustomerListUploadDialogProps) {
  const [name, setName] = useState("");
  const [identifierType, setIdentifierType] = useState<HashedIdentifierType>("email");
  const [countryCode, setCountryCode] = useState(defaultCountryCode);
  const [pastedText, setPastedText] = useState("");
  const [hashedResult, setHashedResult] = useState<HashedCustomerListResult | null>(null);
  const [isHashing, setIsHashing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [idempotencyKey] = useState(() => createClientIdempotencyKey("list"));

  function resetHashedResult() {
    setHashedResult(null);
  }

  async function readSelectedFileIntoTextArea(file: File | undefined) {
    if (!file) return;
    if (file.size > maximumFileBytes) {
      setErrorMessage("That file is larger than 5 MB. Split it into smaller lists.");
      return;
    }
    setErrorMessage(null);
    setPastedText(await file.text());
    resetHashedResult();
  }

  async function normalizeAndHashListLocally() {
    const values = splitCustomerListTextIntoValues(pastedText);
    if (values.length === 0) {
      setErrorMessage(`Paste or choose a list of ${identifierType === "email" ? "email addresses" : "phone numbers"}.`);
      return;
    }
    setIsHashing(true);
    setErrorMessage(null);
    try {
      setHashedResult(await normalizeAndHashCustomerIdentifiersInBrowser(values, identifierType, countryCode));
      setPastedText("");
    } finally {
      setIsHashing(false);
    }
  }

  async function uploadHashedList() {
    if (!hashedResult || hashedResult.acceptedCount === 0) return;
    if (!name.trim()) {
      setErrorMessage("Name the audience.");
      return;
    }
    setIsUploading(true);
    setErrorMessage(null);
    try {
      onCreated(await audiencesApi.uploadHashedCustomerList(accountId, { name: name.trim().slice(0, 100), identifierType, hashAlgorithm: "sha256", hashedIdentifiers: hashedResult.hashedIdentifiers }, idempotencyKey));
    } catch (error) {
      setErrorMessage(readErrorMessageForDisplay(error));
      setIsUploading(false);
    }
  }

  return (
    <OverlayDialog intent="upload"
      isOpen
      onClose={onClose}
      layout="sidePanel"
      title="Upload a customer list"
      description="Reach people you already know, such as your WhatsApp or email customers."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          {hashedResult ? (
            <Button variant="primary" isLoading={isUploading} disabled={hashedResult.acceptedCount === 0} onClick={uploadHashedList}>
              Upload {formatWholeCount(hashedResult.acceptedCount)} hashed rows
            </Button>
          ) : (
            <Button variant="primary" isLoading={isHashing} onClick={normalizeAndHashListLocally}>
              Hash list on this device
            </Button>
          )}
        </>
      }
    >
      <InlineNotice tone="info" title="Private by design">
        Your list is cleaned and scrambled with SHA-256 here in your browser. Only the scrambled values are sent to Zudomart — raw emails and phone numbers never leave this device.
      </InlineNotice>
      <TextField label="Audience name" value={name} onValueChange={setName} maxLength={100} placeholder="e.g. WhatsApp VIP customers" />
      <div>
        <p style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>The list contains</p>
        <SegmentedControl
          label="The list contains"
          value={identifierType}
          onValueChange={(value) => {
            setIdentifierType(value);
            resetHashedResult();
          }}
          options={[
            { value: "email", label: "Email addresses" },
            { value: "phone", label: "Phone numbers" },
          ]}
        />
      </div>
      {identifierType === "phone" ? (
        <SelectField label="Country for numbers without a + code" value={countryCode} onValueChange={setCountryCode} options={supportedAccountCountries.map((country) => ({ value: country.code, label: country.name }))} hint="For example 0803 555 0142 becomes +234 803 555 0142 for Nigeria." />
      ) : null}
      {hashedResult ? (
        <>
          <div className={styles.hashSummary}>
            <div className={styles.hashFigure}>
              <p className={styles.hashFigureValue}>{formatWholeCount(hashedResult.acceptedCount)}</p>
              <p className={styles.description}>Ready to upload</p>
            </div>
            <div className={styles.hashFigure}>
              <p className={styles.hashFigureValue}>{formatWholeCount(hashedResult.duplicateCount)}</p>
              <p className={styles.description}>Duplicates removed</p>
            </div>
            <div className={styles.hashFigure}>
              <p className={styles.hashFigureValue}>{formatWholeCount(hashedResult.rejectedCount)}</p>
              <p className={styles.description}>Not valid, skipped</p>
            </div>
          </div>
          {hashedResult.acceptedCount < 100 ? <InlineNotice tone="caution">Lists usually need at least 100 matched people to be used in ads.</InlineNotice> : null}
          <Button variant="ghost" size="small" onClick={resetHashedResult}>
            Start over with a different list
          </Button>
        </>
      ) : (
        <>
          <div>
            <label htmlFor="customer-list-file" style={{ fontSize: 12.5, fontWeight: 600, display: "block", marginBottom: 6 }}>
              Choose a .csv or .txt file
            </label>
            <input id="customer-list-file" className={styles.fileInput} type="file" accept=".csv,.txt,text/csv,text/plain" onChange={(event) => readSelectedFileIntoTextArea(event.target.files?.[0])} />
          </div>
          <TextAreaField label="Or paste the list" value={pastedText} onValueChange={setPastedText} rows={8} placeholder={identifierType === "email" ? "ada@example.com\nchidi@example.com" : "08035550142\n+2348095550177"} hint={`One per line, or separated by commas. Up to ${formatWholeCount(maximumCustomerListRows)} rows.`} />
        </>
      )}
      {errorMessage ? <InlineNotice tone="error">{errorMessage}</InlineNotice> : null}
    </OverlayDialog>
  );
}
