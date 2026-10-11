"use client";

import { useState, type ReactNode } from "react";

import { ErrorBlock, LoadingBlock } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toastProvider";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchVersionedRecord, type VersionedCollectionEndpoint } from "@/services/configurationApi.service";
import type { VersionedRecord } from "@/types/platformConfiguration.type";

import { SaveVersionedChangesDialog } from "./saveVersionedChangesDialog";
import { useVersionedDraft } from "./useVersionedDraft.hook";
import { VersionedEditorToolbar } from "./versionedEditorToolbar";
import { VersionHistoryPanel } from "./versionHistoryPanel";

interface VersionedDocumentSectionProps<Content> {
  readonly endpoint: VersionedCollectionEndpoint<Content>;
  readonly recordId: string;
  readonly title: string;
  readonly canWrite: boolean;
  readonly renderEditor: (content: Content, updateContent: (updater: (current: Content) => Content) => void, canWrite: boolean) => ReactNode;
}

export function VersionedDocumentSection<Content>({ endpoint, recordId, title, canWrite, renderEditor }: VersionedDocumentSectionProps<Content>) {
  const { showToast } = useToast();
  const query = useAdminQuery((signal) => fetchVersionedRecord(endpoint, recordId, signal), `${endpoint.basePath}/${recordId}`);
  const draft = useVersionedDraft(endpoint, query.data);
  const [isSaveOpen, setIsSaveOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  function replaceRecord(record: VersionedRecord<Content>) {
    query.replaceData(() => record);
  }

  async function confirmSave(reason: string) {
    const saved = await draft.saveDraft(recordId, reason);
    if (saved) {
      replaceRecord(saved);
      setIsSaveOpen(false);
      showToast(`${title} saved as version ${saved.version}.`);
    }
  }

  if (query.errorMessage) return <ErrorBlock variant="section" error={query.error} message={query.errorMessage} onRetry={query.reload} />;
  if (!query.data || draft.draftContent === null) return <LoadingBlock lines={6} />;
  const record = query.data;
  return (
    <>
      <VersionedEditorToolbar
        record={record}
        isDirty={draft.isDirty}
        canWrite={canWrite}
        onDiscard={draft.discardDraft}
        onRequestSave={() => {
          draft.clearSaveError();
          setIsSaveOpen(true);
        }}
        onOpenHistory={() => setIsHistoryOpen(true)}
      />
      {renderEditor(draft.draftContent, draft.updateDraftContent, canWrite)}
      <SaveVersionedChangesDialog
        isOpen={isSaveOpen}
        title={`Save ${title.toLowerCase()}`}
        beforeContent={record.content}
        afterContent={draft.draftContent}
        nextVersionNumber={record.version + 1}
        isSaving={draft.isSaving}
        errorMessage={draft.saveErrorMessage}
        onConfirm={(reason) => void confirmSave(reason)}
        onClose={() => setIsSaveOpen(false)}
      />
      <VersionHistoryPanel
        isOpen={isHistoryOpen}
        title={title}
        endpoint={endpoint}
        currentRecord={record}
        canWrite={canWrite}
        onRestored={(restored) => {
          replaceRecord(restored);
          setIsHistoryOpen(false);
          showToast(`${title} restored as version ${restored.version}.`);
        }}
        onClose={() => setIsHistoryOpen(false)}
      />
    </>
  );
}
