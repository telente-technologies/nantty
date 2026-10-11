"use client";

import { useState } from "react";

import { useAdminSession } from "@/components/session/adminSessionProvider";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { ErrorBlock, NoticeBanner } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/statusBadge";
import { KeyValueList, SectionHeading } from "@/components/ui/surfaces";
import { useToast } from "@/components/ui/toastProvider";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { createLegalVersionDraft, returnLegalVersionToDraft, submitLegalVersionForReview, updateLegalVersionDraft } from "@/services/legalApi.service";
import type { LegalVersion, LegalVersionInput } from "@/types/legal.type";
import { formatDateOnly, formatDateTime } from "@/utils/formatting.util";

import styles from "./legal.module.css";
import { LegalMarkdownPreview } from "./legalMarkdownPreview";
import { LegalPublishDialog } from "./legalPublishDialog";
import { LegalVersionDiff } from "./legalVersionDiff";
import { LegalVersionEditor } from "./legalVersionEditor";

interface LegalOpenVersionPanelProps {
  readonly documentKey: string;
  readonly currentVersion: LegalVersion | null;
  readonly openVersion: LegalVersion | null;
  readonly canEdit: boolean;
  readonly canPublish: boolean;
  readonly onChanged: () => void;
}

export function LegalOpenVersionPanel({ documentKey, currentVersion, openVersion, canEdit, canPublish, onChanged }: LegalOpenVersionPanelProps) {
  const { showToast } = useToast();
  const { admin } = useAdminSession();
  const [isStarting, setIsStarting] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isReturning, setIsReturning] = useState(false);
  const saveMutation = useAdminMutation(async (input: { form: LegalVersionInput; shouldSubmit: boolean }) => {
    const saved = openVersion ? await updateLegalVersionDraft(openVersion.id, input.form) : await createLegalVersionDraft(documentKey, input.form);
    return input.shouldSubmit ? submitLegalVersionForReview(saved.id) : saved;
  });
  const returnMutation = useAdminMutation((reason: string) => returnLegalVersionToDraft(openVersion?.id ?? "", reason));
  const baseMarkdown = currentVersion?.bodyMarkdown ?? "# Title\n\n## 1. Section\nWrite the first version here.";

  async function save(form: LegalVersionInput, shouldSubmit: boolean) {
    const result = await saveMutation.run({ form, shouldSubmit });
    if (result) {
      showToast(shouldSubmit ? "Submitted for review. A second Legal admin or a superadmin must publish it." : "Draft saved.");
      setIsStarting(false);
      onChanged();
    }
  }

  if (!openVersion && !isStarting) {
    return (
      <div className={styles.stack}>
        <p className={styles.muted}>No version is being worked on. Starting one copies the current published text.</p>
        {canEdit ? <Button variant="primary" onClick={() => setIsStarting(true)}>Start a new version</Button> : null}
      </div>
    );
  }

  if (!openVersion || openVersion.status === "DRAFT") {
    return <LegalVersionEditor key={openVersion?.id ?? "new"} initialVersion={openVersion} baseMarkdown={baseMarkdown} canEdit={canEdit} isBusy={saveMutation.isRunning} errorMessage={saveMutation.errorMessage} onSave={(form) => void save(form, false)} onSaveAndSubmit={(form) => void save(form, true)} />;
  }

  const isOwnSubmission = openVersion.submittedByName === admin.name || openVersion.createdByName === admin.name;
  return (
    <div className={styles.stack}>
      <NoticeBanner tone="info" title="Waiting for a second person">{isOwnSubmission ? "You wrote or submitted this version, so a different Legal admin or a superadmin has to publish it." : "You can review the text and diff below, then publish or return it to the author."}</NoticeBanner>
      <KeyValueList columns={2} items={[
        { label: "Version", value: <>v{openVersion.versionNumber} <StatusBadge status={openVersion.status} /></> },
        { label: "Effective", value: formatDateOnly(openVersion.effectiveAt) },
        { label: "Material change", value: openVersion.isMaterialChange ? "Yes. LEGAL REVIEW flagged" : "No" },
        { label: "Submitted by", value: `${openVersion.submittedByName}, ${formatDateTime(openVersion.submittedAt)}` },
        { label: "Change summary", value: openVersion.changeSummary },
      ]} />
      <div className={styles.row}>
        {canPublish ? <Button variant="primary" iconName="shield24" disabled={isOwnSubmission} onClick={() => setIsPublishing(true)}>Publish</Button> : null}
        {canPublish ? <Button variant="quietDanger" disabled={isOwnSubmission} onClick={() => setIsReturning(true)}>Return to draft</Button> : null}
      </div>
      {returnMutation.errorMessage ? <ErrorBlock error={returnMutation.error} message={returnMutation.errorMessage} /> : null}
      {currentVersion ? <><SectionHeading>Changes from the current version</SectionHeading><LegalVersionDiff leftLabel={`v${currentVersion.versionNumber} (current)`} rightLabel={`v${openVersion.versionNumber} (proposed)`} leftMarkdown={currentVersion.bodyMarkdown} rightMarkdown={openVersion.bodyMarkdown} /></> : <LegalMarkdownPreview markdown={openVersion.bodyMarkdown} />}
      {isPublishing ? <LegalPublishDialog version={openVersion} onClose={() => setIsPublishing(false)} onPublished={() => { setIsPublishing(false); showToast("Published. The Policy updated email is queued."); onChanged(); }} /> : null}
      {isReturning ? <ConfirmActionDialog intent="legal" isOpen title="Return to draft" confirmLabel="Return" reasonHint="Tell the author what to fix." isBusy={returnMutation.isRunning} errorMessage={returnMutation.errorMessage} onConfirm={async (reason) => { const result = await returnMutation.run(reason); if (result) { setIsReturning(false); onChanged(); } }} onClose={() => setIsReturning(false)} /> : null}
    </div>
  );
}
