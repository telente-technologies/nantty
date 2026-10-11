"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ErrorBlock, LoadingBlock } from "@/components/ui/feedback";
import { TextAreaField, TextField } from "@/components/ui/formFields";
import { useToast } from "@/components/ui/toastProvider";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchLegalNoticeDraft, saveLegalNoticeDraft, sendLegalNoticeTestToMyself } from "@/services/legalApi.service";
import type { LegalNoticeDraft } from "@/types/legal.type";
import { formatDateTime } from "@/utils/formatting.util";

import styles from "./legal.module.css";
import { LegalNoticeEmailFrame } from "./legalNoticeEmailFrame";

function DraftForm({ initial, versionId, canEdit, canSendTest }: { readonly initial: LegalNoticeDraft; readonly versionId: string; readonly canEdit: boolean; readonly canSendTest: boolean }) {
  const { showToast } = useToast();
  const [draft, setDraft] = useState(initial);
  const [subject, setSubject] = useState(initial.subject);
  const [summaryText, setSummaryText] = useState(initial.summaryText);
  const [changesText, setChangesText] = useState(initial.whatChanged.join("\n"));
  const [reacceptNote, setReacceptNote] = useState(initial.reacceptNote ?? "");
  const saveMutation = useAdminMutation(() => saveLegalNoticeDraft(versionId, { subject, summaryText, whatChanged: changesText.split("\n").map((line) => line.trim()).filter(Boolean), reacceptNote: reacceptNote.trim() || null }));
  const testMutation = useAdminMutation(() => sendLegalNoticeTestToMyself(versionId));
  const livePreview: LegalNoticeDraft = { ...draft, subject, summaryText, whatChanged: changesText.split("\n").map((line) => line.trim()).filter(Boolean), reacceptNote: reacceptNote.trim() || null };

  async function save() {
    const saved = await saveMutation.run(undefined);
    if (saved) { setDraft(saved); showToast("Email draft saved."); }
  }

  async function sendTest() {
    const saved = await saveMutation.run(undefined);
    if (!saved) return;
    const updated = await testMutation.run(undefined);
    if (updated) { setDraft(updated); showToast(`Test email sent to ${updated.testSends[0]?.sentToEmail ?? "you"}.`); }
  }

  return (
    <div className={styles.editorGrid}>
      <div className={styles.stack}>
        <TextField label="Subject" value={subject} disabled={!canEdit} onChange={(event) => setSubject(event.target.value)} />
        <TextAreaField label="Summary of changes" rows={3} value={summaryText} disabled={!canEdit} onChange={(event) => setSummaryText(event.target.value)} />
        <TextAreaField label="What changed (one line each, generated from the version diff)" rows={6} value={changesText} disabled={!canEdit} onChange={(event) => setChangesText(event.target.value)} />
        <TextAreaField label="Re-accept note (material changes)" rows={3} value={reacceptNote} disabled={!canEdit} onChange={(event) => setReacceptNote(event.target.value)} hint="The effective date comes from the version." />
        {saveMutation.errorMessage ?? testMutation.errorMessage ? <ErrorBlock error={saveMutation.error} message={saveMutation.errorMessage ?? testMutation.errorMessage ?? ""} /> : null}
        <div className={styles.row}>
          {canEdit ? <Button isBusy={saveMutation.isRunning} onClick={() => void save()}>Save email draft</Button> : null}
          {canSendTest ? <Button variant="secondary" iconName="export24" isBusy={testMutation.isRunning} onClick={() => void sendTest()}>Send a test to myself</Button> : null}
        </div>
        {draft.testSends[0] ? <p className={styles.muted}>Last test: {draft.testSends[0].sentToEmail}, {formatDateTime(draft.testSends[0].sentAt)}.</p> : null}
        {draft.updatedByName ? <p className={styles.muted}>Edited by {draft.updatedByName}, {formatDateTime(draft.updatedAt)}.</p> : null}
      </div>
      <LegalNoticeEmailFrame draft={livePreview} />
    </div>
  );
}

export function LegalNoticeDraftPanel({ versionId, canEdit, canSendTest }: { readonly versionId: string; readonly canEdit: boolean; readonly canSendTest: boolean }) {
  const { data, errorMessage, isLoading, reload } = useAdminQuery((signal) => fetchLegalNoticeDraft(versionId, signal), versionId);
  if (isLoading) return <LoadingBlock label="Loading the email draft" lines={4} />;
  if (errorMessage || !data) return <ErrorBlock variant="section" message={errorMessage ?? "No draft."} onRetry={reload} />;
  return <DraftForm key={versionId} initial={data} versionId={versionId} canEdit={canEdit} canSendTest={canSendTest} />;
}
