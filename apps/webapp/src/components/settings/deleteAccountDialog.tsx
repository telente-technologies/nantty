"use client";

import { Dialog } from "@/components/ui/dialog";
import { TextField } from "@/components/ui/field";
import { TrashIcon } from "@/components/ui/icons";

import styles from "./settings.module.css";

export const accountDeletionConfirmationWord = "DELETE";

interface DeleteAccountDialogProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly confirmation: string;
  readonly onConfirmationChange: (value: string) => void;
  readonly deletion: { readonly isPending: boolean; readonly isSuccess: boolean; readonly errorMessage: string | null; readonly confirm: () => void };
}

export function DeleteAccountDialog({ isOpen, onClose, confirmation, onConfirmationChange, deletion }: DeleteAccountDialogProps) {
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      role="alertdialog"
      tone="danger"
      icon={<TrashIcon size={24} />}
      title="Delete your account?"
      description="Your account will be permanently deleted in 30 days. Log in any time before then to cancel. Order and payment records the law requires are kept."
      dismissible={!deletion.isPending}
      actions={[
        { label: "Delete my account", variant: "danger", disabled: confirmation.trim() !== accountDeletionConfirmationWord, busy: deletion.isPending, onClick: deletion.confirm },
        { label: "Keep my account", variant: "secondary", onClick: onClose, isInitialFocus: true },
      ]}
    >
      <div className={styles.confirmBox}>
        <TextField label={`Type ${accountDeletionConfirmationWord} to confirm`} value={confirmation} onChange={(event) => onConfirmationChange(event.target.value)} autoCapitalize="characters" autoComplete="off" />
        {deletion.errorMessage ? <p className={styles.errorText} role="alert">{deletion.errorMessage}</p> : null}
        {deletion.isSuccess ? <p role="status">Your account is scheduled for deletion.</p> : null}
      </div>
    </Dialog>
  );
}
