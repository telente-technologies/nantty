"use client";

import { useMutation } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { ModalDialog } from "@/components/ui/modalDialog";
import { showToast } from "@/components/ui/toast";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { copyrightAccountService, isValidContactEmail, isValidEvidenceLink, readSegments, splitEvidenceLinks, type SegmentDraft } from "@/services/copyrightAccount.service";
import type { CopyrightClaimScope, CopyrightClaimTargetType } from "@/types";

import styles from "./copyright.module.css";
import { COPYRIGHT_ACCURACY_DECLARATION, COPYRIGHT_GOOD_FAITH_DECLARATION, COPYRIGHT_SIGNATURE_EXPLANATION } from "./copyrightLegal.constant";

interface CopyrightClaimDialogProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly targetType: CopyrightClaimTargetType;
  readonly targetId: string;
}

function Field({ label, hint, children }: { readonly label: string; readonly hint?: string; readonly children: ReactNode }) {
  return (
    <label className={styles.field}>
      {label}
      {hint ? <span className={styles.hint}>{hint}</span> : null}
      {children}
    </label>
  );
}

export function CopyrightClaimDialog({ isOpen, onClose, targetType, targetId }: CopyrightClaimDialogProps) {
  const [claimScope, setClaimScope] = useState<CopyrightClaimScope>(targetType === "sound" ? "audio" : "video");
  const [claimantName, setClaimantName] = useState("");
  const [organization, setOrganization] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [claimantPhone, setClaimantPhone] = useState("");
  const [workDescription, setWorkDescription] = useState("");
  const [originalWorkUrl, setOriginalWorkUrl] = useState("");
  const [ownershipStatement, setOwnershipStatement] = useState("");
  const [proofLinks, setProofLinks] = useState("");
  const [segmentDrafts, setSegmentDrafts] = useState<SegmentDraft[]>([{ start: "", end: "" }]);
  const [goodFaith, setGoodFaith] = useState(false);
  const [accuracy, setAccuracy] = useState(false);
  const [signatureName, setSignatureName] = useState("");

  const proofUrls = splitEvidenceLinks(proofLinks);
  const segments = readSegments(segmentDrafts);
  const isOriginalLinkValid = isValidEvidenceLink(originalWorkUrl);
  const areProofLinksValid = proofUrls.length > 0 && proofUrls.every(isValidEvidenceLink);
  const doesSignatureMatch = signatureName.trim() !== "" && signatureName.trim().toLowerCase() === claimantName.trim().toLowerCase();
  const canSubmit =
    claimantName.trim().length >= 2 && isValidContactEmail(contactEmail) && workDescription.trim().length >= 10 && ownershipStatement.trim().length >= 10 && isOriginalLinkValid && areProofLinksValid &&
    segments.isValid && (targetType === "sound" || segments.segments.length > 0) && goodFaith && accuracy && doesSignatureMatch;

  const submit = useMutation({
    mutationFn: () =>
      copyrightAccountService.submitCopyrightClaim({
        targetType, targetId, claimScope, claimantName: claimantName.trim(), organization: organization.trim() || undefined, claimantPhone: claimantPhone.trim() || undefined,
        workDescription: workDescription.trim(), ownershipStatement: ownershipStatement.trim(), contactEmail: contactEmail.trim(), originalWorkUrl: originalWorkUrl.trim(), proofUrls,
        segments: segments.segments, goodFaith: true, accuracyDeclared: true, signatureName: signatureName.trim(),
      }),
    onSuccess: () => {
      showToast({ text: "Copyright claim sent. Our team will contact you by email." });
      onClose();
    },
  });

  const updateSegment = (index: number, change: Partial<SegmentDraft>) => setSegmentDrafts((drafts) => drafts.map((draft, position) => (position === index ? { ...draft, ...change } : draft)));

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={onClose}
      title="File a copyright claim"
      description="Only the rights holder or their authorised agent should file this. Knowingly false claims can have legal consequences."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => submit.mutate()} disabled={!canSubmit} busy={submit.isPending}>Submit claim</Button>
        </>
      }
    >
      <div className={styles.form}>
        <fieldset className={styles.section}>
          <legend className={styles.sectionTitle}>What is being used without permission?</legend>
          <div className={styles.scopeRow}>
            <label className={styles.checkbox}><input type="radio" name="claim-scope" checked={claimScope === "audio"} onChange={() => setClaimScope("audio")} /> The audio (music or sound)</label>
            <label className={styles.checkbox}><input type="radio" name="claim-scope" checked={claimScope === "video"} onChange={() => setClaimScope("video")} /> The video itself</label>
          </div>
          <span className={styles.hint}>{claimScope === "audio" ? "If upheld, we mute the audio and keep the video up." : "If upheld, the uploader is asked to remove it, and we take it down if they don't."}</span>
        </fieldset>
        <fieldset className={styles.section}>
          <legend className={styles.sectionTitle}>About you</legend>
          <Field label="Full legal name"><input className={styles.input} value={claimantName} maxLength={120} autoComplete="name" onChange={(event) => setClaimantName(event.target.value)} /></Field>
          <Field label="Company or label (optional)"><input className={styles.input} value={organization} maxLength={160} onChange={(event) => setOrganization(event.target.value)} /></Field>
          <Field label="Contact email"><input className={styles.input} type="email" value={contactEmail} maxLength={254} autoComplete="email" aria-invalid={contactEmail !== "" && !isValidContactEmail(contactEmail)} onChange={(event) => setContactEmail(event.target.value)} /></Field>
          <Field label="Phone (optional)"><input className={styles.input} type="tel" value={claimantPhone} maxLength={40} autoComplete="tel" onChange={(event) => setClaimantPhone(event.target.value)} /></Field>
        </fieldset>
        <fieldset className={styles.section}>
          <legend className={styles.sectionTitle}>Your original work</legend>
          <Field label="Describe your copyrighted work"><textarea className={styles.input} value={workDescription} maxLength={1000} onChange={(event) => setWorkDescription(event.target.value)} /></Field>
          <Field label="Link to the original" hint="A public link, or a private link our team can open (for example a shared drive)."><input className={styles.input} type="url" value={originalWorkUrl} maxLength={2048} placeholder="https://" aria-invalid={originalWorkUrl !== "" && !isOriginalLinkValid} onChange={(event) => setOriginalWorkUrl(event.target.value)} /></Field>
          <span className={styles.hint}>When does your work appear? Use minutes and seconds, for example 0:12 to 0:45.</span>
          {segmentDrafts.map((draft, index) => (
            <div key={index} className={styles.segmentRow}>
              <Field label={`Start ${index + 1}`}><input className={styles.input} value={draft.start} placeholder="0:12" onChange={(event) => updateSegment(index, { start: event.target.value })} /></Field>
              <Field label={`End ${index + 1}`}><input className={styles.input} value={draft.end} placeholder="0:45" onChange={(event) => updateSegment(index, { end: event.target.value })} /></Field>
            </div>
          ))}
          {segmentDrafts.length < 5 ? <button type="button" className={styles.linkButton} onClick={() => setSegmentDrafts((drafts) => [...drafts, { start: "", end: "" }])}>Add another segment</button> : null}
        </fieldset>
        <fieldset className={styles.section}>
          <legend className={styles.sectionTitle}>Proof of ownership</legend>
          <Field label="How do you own it?"><textarea className={styles.input} value={ownershipStatement} maxLength={1000} onChange={(event) => setOwnershipStatement(event.target.value)} /></Field>
          <Field label="Proof links (one per line)" hint="Registration certificates, distributor or release pages, contracts in a shared folder."><textarea className={styles.input} value={proofLinks} maxLength={4000} aria-invalid={proofLinks !== "" && !areProofLinksValid} onChange={(event) => setProofLinks(event.target.value)} /></Field>
        </fieldset>
        <fieldset className={styles.section}>
          <legend className={styles.sectionTitle}>Declarations</legend>
          <label className={styles.checkbox}><input type="checkbox" checked={goodFaith} onChange={(event) => setGoodFaith(event.target.checked)} /> {COPYRIGHT_GOOD_FAITH_DECLARATION}</label>
          <label className={styles.checkbox}><input type="checkbox" checked={accuracy} onChange={(event) => setAccuracy(event.target.checked)} /> {COPYRIGHT_ACCURACY_DECLARATION}</label>
          <Field label="Electronic signature" hint={COPYRIGHT_SIGNATURE_EXPLANATION}><input className={styles.input} value={signatureName} maxLength={160} aria-invalid={signatureName !== "" && !doesSignatureMatch} onChange={(event) => setSignatureName(event.target.value)} /></Field>
        </fieldset>
        {submit.isError ? <p className={styles.error} role="alert">{readErrorMessageForDisplay(submit.error)}</p> : null}
      </div>
    </ModalDialog>
  );
}
