"use client";

import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { DiffView } from "@/components/ui/diffView";

import styles from "./versionedEditor.module.css";

interface SaveVersionedChangesDialogProps {
  readonly isOpen: boolean;
  readonly title: string;
  readonly beforeContent: unknown;
  readonly afterContent: unknown;
  readonly nextVersionNumber: number;
  readonly isSaving: boolean;
  readonly errorMessage: string | null;
  readonly confirmLabel?: string;
  readonly onConfirm: (reason: string) => void;
  readonly onClose: () => void;
}

export function SaveVersionedChangesDialog({ isOpen, title, beforeContent, afterContent, nextVersionNumber, isSaving, errorMessage, confirmLabel, onConfirm, onClose }: SaveVersionedChangesDialogProps) {
  return (
    <ConfirmActionDialog intent="publish"
      isOpen={isOpen}
      title={title}
      description={`This creates version ${nextVersionNumber}. Earlier versions stay in the history and can be restored.`}
      confirmLabel={confirmLabel ?? `Save version ${nextVersionNumber}`}
      reasonLabel="Why are you changing this? (saved with the version and the audit log)"
      requiresStepUp
      isBusy={isSaving}
      errorMessage={errorMessage}
      onConfirm={onConfirm}
      onClose={onClose}
    >
      <div className={styles.diffScroll}>
        <DiffView before={beforeContent} after={afterContent} isUnchangedHidden />
      </div>
    </ConfirmActionDialog>
  );
}
