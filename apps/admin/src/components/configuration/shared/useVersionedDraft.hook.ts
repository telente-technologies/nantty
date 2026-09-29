"use client";

import { useCallback, useMemo, useState } from "react";

import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { saveVersionedRecord, type VersionedCollectionEndpoint } from "@/services/configurationApi.service";
import type { VersionedRecord } from "@/types/platformConfiguration.type";

export interface VersionedDraftState<Content> {
  readonly draftContent: Content | null;
  readonly isDirty: boolean;
  readonly updateDraftContent: (updater: (current: Content) => Content) => void;
  readonly discardDraft: () => void;
  readonly saveDraft: (recordId: string, reason: string) => Promise<VersionedRecord<Content> | null>;
  readonly isSaving: boolean;
  readonly saveErrorMessage: string | null;
  readonly clearSaveError: () => void;
}

export function useVersionedDraft<Content>(endpoint: VersionedCollectionEndpoint<Content>, record: VersionedRecord<Content> | null, blankContent: Content | null = null): VersionedDraftState<Content> {
  const [editedContent, setEditedContent] = useState<{ basedOnVersion: number; content: Content } | null>(null);
  const baseContent = record?.content ?? blankContent;
  const baseVersion = record?.version ?? 0;
  const draftContent = editedContent && editedContent.basedOnVersion === baseVersion ? editedContent.content : baseContent;
  const isDirty = useMemo(() => editedContent !== null && editedContent.basedOnVersion === baseVersion && JSON.stringify(editedContent.content) !== JSON.stringify(baseContent), [editedContent, baseVersion, baseContent]);

  const updateDraftContent = useCallback(
    (updater: (current: Content) => Content) => {
      setEditedContent((current) => {
        const startingContent = current && current.basedOnVersion === baseVersion ? current.content : baseContent;
        return startingContent === null ? current : { basedOnVersion: baseVersion, content: updater(startingContent) };
      });
    },
    [baseVersion, baseContent],
  );

  const discardDraft = useCallback(() => setEditedContent(null), []);

  const performSave = useCallback(
    async ({ recordId, reason }: { recordId: string; reason: string }) => {
      if (draftContent === null) throw new Error("Nothing to save.");
      const saved = await saveVersionedRecord(endpoint, recordId, { expectedVersion: baseVersion, reason, content: draftContent });
      setEditedContent(null);
      return saved;
    },
    [endpoint, baseVersion, draftContent],
  );
  const saveMutation = useAdminMutation(performSave);

  return {
    draftContent,
    isDirty,
    updateDraftContent,
    discardDraft,
    saveDraft: (recordId, reason) => saveMutation.run({ recordId, reason }),
    isSaving: saveMutation.isRunning,
    saveErrorMessage: saveMutation.errorMessage,
    clearSaveError: saveMutation.clearError,
  };
}
