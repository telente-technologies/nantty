"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ErrorBlock, NoticeBanner } from "@/components/ui/feedback";
import { CheckboxField, TextAreaField, TextField } from "@/components/ui/formFields";
import { materialChangeNoticeDays } from "@/constants/legalDocuments.constant";
import type { LegalVersion, LegalVersionInput } from "@/types/legal.type";

import styles from "./legal.module.css";
import { LegalMarkdownPreview } from "./legalMarkdownPreview";

const dayMilliseconds = 86_400_000;

function toDateInputValue(isoText: string): string {
  return isoText.slice(0, 10);
}

function fromDateInputValue(dateText: string): string {
  return `${dateText}T00:00:00.000Z`;
}

function readDateInDays(days: number): string {
  return toDateInputValue(new Date(Date.now() + days * dayMilliseconds).toISOString());
}

interface LegalVersionEditorProps {
  readonly initialVersion: LegalVersion | null;
  readonly baseMarkdown: string;
  readonly isBusy: boolean;
  readonly errorMessage: string | null;
  readonly canEdit: boolean;
  readonly onSave: (input: LegalVersionInput) => void;
  readonly onSaveAndSubmit?: (input: LegalVersionInput) => void;
}

export function LegalVersionEditor({ initialVersion, baseMarkdown, isBusy, errorMessage, canEdit, onSave, onSaveAndSubmit }: LegalVersionEditorProps) {
  const [bodyMarkdown, setBodyMarkdown] = useState(initialVersion?.bodyMarkdown ?? baseMarkdown);
  const [changeSummary, setChangeSummary] = useState(initialVersion?.changeSummary ?? "");
  const [isMaterialChange, setIsMaterialChange] = useState(initialVersion?.isMaterialChange ?? false);
  const [effectiveDate, setEffectiveDate] = useState(initialVersion ? toDateInputValue(initialVersion.effectiveAt) : readDateInDays(1));
  const input: LegalVersionInput = { bodyMarkdown, changeSummary, isMaterialChange, effectiveAt: fromDateInputValue(effectiveDate) };
  const isComplete = bodyMarkdown.trim().length >= 20 && changeSummary.trim().length >= 10 && effectiveDate.length === 10;
  const isShortNotice = isMaterialChange && Date.parse(input.effectiveAt) < Date.now() + (materialChangeNoticeDays - 1) * dayMilliseconds;

  function changeMaterialFlag(isChecked: boolean) {
    setIsMaterialChange(isChecked);
    setEffectiveDate(readDateInDays(isChecked ? materialChangeNoticeDays : 1));
  }

  return (
    <div className={styles.stack}>
      {initialVersion?.returnedReason ? <NoticeBanner tone="caution" title="Returned by the reviewer">{initialVersion.returnedReason}</NoticeBanner> : null}
      <div className={styles.formGrid}>
        <TextAreaField label="Change summary (shown to users in the email)" rows={3} value={changeSummary} disabled={!canEdit} onChange={(event) => setChangeSummary(event.target.value)} hint="At least 10 characters. Say what changed in plain words." />
        <div className={styles.stack}>
          <CheckboxField label={<strong>Material change</strong>} description="Users must accept again by the effective date." checked={isMaterialChange} disabled={!canEdit} onChange={(event) => changeMaterialFlag(event.target.checked)} />
          <TextField label="Effective date" type="date" value={effectiveDate} disabled={!canEdit} onChange={(event) => setEffectiveDate(event.target.value)} hint={isMaterialChange ? `Defaults to ${materialChangeNoticeDays} days from today. LEGAL REVIEW: confirm this date before publishing.` : "Non-material changes can apply straight away."} />
        </div>
      </div>
      {isShortNotice ? <NoticeBanner tone="caution" title="LEGAL REVIEW: shorter than 30 days">This material change gives users less than {materialChangeNoticeDays} days. Publishing will ask for confirmation that legal cleared it.</NoticeBanner> : null}
      <div className={styles.editorGrid}>
        <TextAreaField label="Document (markdown)" className={styles.markdownInput} rows={20} value={bodyMarkdown} disabled={!canEdit} onChange={(event) => setBodyMarkdown(event.target.value)} hint="# Heading, ## Section, - bullet, **bold**" />
        <div className={styles.stack}><strong>Preview</strong><LegalMarkdownPreview markdown={bodyMarkdown} /></div>
      </div>
      {errorMessage ? <ErrorBlock message={errorMessage} /> : null}
      {canEdit ? (
        <div className={styles.row}>
          <Button variant="secondary" isBusy={isBusy} disabled={!isComplete} onClick={() => onSave(input)}>Save draft</Button>
          {onSaveAndSubmit ? <Button variant="primary" isBusy={isBusy} disabled={!isComplete} onClick={() => onSaveAndSubmit(input)}>Save and submit for review</Button> : null}
        </div>
      ) : <p className={styles.muted}>You can read this document but not edit it.</p>}
    </div>
  );
}
