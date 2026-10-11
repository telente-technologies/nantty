"use client";

import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { NoticeBanner } from "@/components/ui/feedback";
import { TextField } from "@/components/ui/formFields";
import { SidePanel } from "@/components/ui/sidePanel";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { archiveVersionedRecord, type VersionedCollectionEndpoint } from "@/services/configurationApi.service";
import type { VersionedRecord } from "@/types/platformConfiguration.type";

import { SaveVersionedChangesDialog } from "./saveVersionedChangesDialog";
import { useVersionedDraft } from "./useVersionedDraft.hook";
import styles from "./versionedEditor.module.css";
import { VersionHistoryPanel } from "./versionHistoryPanel";
import { VersionMetaLine } from "./versionMetaLine";

interface VersionedRecordPanelProps<Content> {
  readonly endpoint: VersionedCollectionEndpoint<Content>;
  readonly record: VersionedRecord<Content> | null;
  readonly blankContent: Content;
  readonly title: string;
  readonly canWrite: boolean;
  readonly canArchive?: boolean;
  readonly newRecordIdLabel?: string;
  readonly newRecordIdHint?: string;
  readonly normalizeNewRecordId?: (typed: string) => string;
  readonly deriveNewRecordId?: (content: Content) => string;
  readonly findDraftProblem?: (content: Content) => string | null;
  readonly renderEditor: (content: Content, updateContent: (updater: (current: Content) => Content) => void, canWrite: boolean) => ReactNode;
  readonly onChanged: (record: VersionedRecord<Content>, verb: "saved" | "restored" | "archived") => void;
  readonly onClose: () => void;
}

export function VersionedRecordPanel<Content>({ endpoint, record, blankContent, title, canWrite, canArchive = false, newRecordIdLabel = "ID", newRecordIdHint, normalizeNewRecordId = (typed) => typed, deriveNewRecordId, findDraftProblem, renderEditor, onChanged, onClose }: VersionedRecordPanelProps<Content>) {
  const draft = useVersionedDraft(endpoint, record, blankContent);
  const [typedRecordId, setTypedRecordId] = useState("");
  const [isSaveOpen, setIsSaveOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const archive = useAdminMutation((reason: string) => archiveVersionedRecord(endpoint, record?.id ?? "", { expectedVersion: record?.version ?? 0, reason }));
  const isCreating = record === null;
  const content = draft.draftContent ?? blankContent;
  const recordId = record?.id ?? (deriveNewRecordId ? deriveNewRecordId(content) : typedRecordId);
  const draftProblem = findDraftProblem?.(content) ?? null;
  const canSave = canWrite && (isCreating ? recordId.length >= 3 : draft.isDirty) && !draftProblem;

  async function confirmSave(reason: string) {
    const saved = await draft.saveDraft(recordId, reason);
    if (saved) {
      setIsSaveOpen(false);
      onChanged(saved, "saved");
    }
  }

  async function confirmArchive(reason: string) {
    const archived = await archive.run(reason);
    if (archived) {
      setIsArchiveOpen(false);
      onChanged(archived, "archived");
    }
  }

  if (record && isHistoryOpen) {
    return <VersionHistoryPanel isOpen title={title} endpoint={endpoint} currentRecord={record} canWrite={canWrite} onRestored={(restored) => onChanged(restored, "restored")} onClose={() => setIsHistoryOpen(false)} />;
  }

  return (
    <SidePanel
      isOpen
      title={isCreating ? `New ${title.toLowerCase()}` : title}
      subtitle={record ? <VersionMetaLine record={record} isDirty={draft.isDirty} /> : "Saving creates version 1."}
      onClose={onClose}
      width="wide"
      footer={
        <>
          {canWrite ? (
            <Button variant="primary" iconName="shield24" disabled={!canSave} onClick={() => { draft.clearSaveError(); setIsSaveOpen(true); }}>
              {isCreating ? "Review and create" : "Review and save"}
            </Button>
          ) : null}
          {record ? (
            <Button variant="ghost" iconName="textIndent24" onClick={() => setIsHistoryOpen(true)}>
              Version history
            </Button>
          ) : null}
          {draft.isDirty ? (
            <Button variant="ghost" onClick={draft.discardDraft}>
              Discard changes
            </Button>
          ) : null}
          {record && canWrite && canArchive ? (
            <Button variant="quietDanger" iconName="trash24" onClick={() => setIsArchiveOpen(true)}>
              Archive
            </Button>
          ) : null}
        </>
      }
    >
      {!canWrite ? <NoticeBanner tone="info">Read only — your permissions don't allow changes here.</NoticeBanner> : null}
      {isCreating && !deriveNewRecordId ? <TextField label={newRecordIdLabel} hint={newRecordIdHint} value={typedRecordId} onChange={(event) => setTypedRecordId(normalizeNewRecordId(event.target.value))} autoComplete="off" spellCheck={false} /> : null}
      {isCreating && deriveNewRecordId ? <p className={styles.readOnlyNote}>ID: <code>{recordId}</code></p> : null}
      {renderEditor(content, draft.updateDraftContent, canWrite)}
      {draftProblem ? <NoticeBanner tone="caution">{draftProblem}</NoticeBanner> : null}
      <SaveVersionedChangesDialog
        isOpen={isSaveOpen}
        title={isCreating ? `Create ${title.toLowerCase()}` : `Save ${title.toLowerCase()}`}
        beforeContent={record?.content ?? null}
        afterContent={content}
        nextVersionNumber={(record?.version ?? 0) + 1}
        confirmLabel={isCreating ? "Create version 1" : undefined}
        isSaving={draft.isSaving}
        errorMessage={draft.saveErrorMessage}
        onConfirm={(reason) => void confirmSave(reason)}
        onClose={() => setIsSaveOpen(false)}
      />
      <ConfirmActionDialog intent="archive"
        isOpen={isArchiveOpen}
        title={`Archive ${title.toLowerCase()}?`}
        description="It stops applying immediately. The history is kept and the audit log records who archived it."
        confirmLabel="Archive"
        tone="danger"
        requiresStepUp
        isBusy={archive.isRunning}
        errorMessage={archive.errorMessage}
        onConfirm={(reason) => void confirmArchive(reason)}
        onClose={() => setIsArchiveOpen(false)}
      />
    </SidePanel>
  );
}
