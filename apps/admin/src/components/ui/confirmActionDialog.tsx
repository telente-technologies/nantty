"use client";

import { useState, type ReactNode } from "react";

import { Button } from "./button";
import { InlineError } from "./feedback";
import { TextAreaField, TextField } from "./formFields";
import { ModalDialog } from "./modalDialog";
import styles from "./confirmActionDialog.module.css";

interface ConfirmActionDialogProps {
  readonly isOpen: boolean;
  readonly title: string;
  readonly description?: ReactNode;
  readonly consequences?: readonly string[];
  readonly confirmLabel: string;
  readonly tone?: "default" | "danger";
  readonly requiresReason?: boolean;
  readonly reasonLabel?: string;
  readonly reasonPlaceholder?: string;
  readonly reasonHint?: string;
  readonly reasonMaximumLength?: number;
  readonly typedConfirmationText?: string;
  readonly requiresStepUp?: boolean;
  readonly isBusy?: boolean;
  readonly errorMessage?: string | null;
  readonly children?: ReactNode;
  readonly isConfirmDisabled?: boolean;
  readonly onConfirm: (reason: string) => void;
  readonly onClose: () => void;
}

export function ConfirmActionDialog(props: ConfirmActionDialogProps) {
  return props.isOpen ? <OpenConfirmActionDialog {...props} /> : null;
}

function OpenConfirmActionDialog({
  isOpen, title, description, consequences = [], confirmLabel, tone = "default", requiresReason = true, reasonLabel = "Reason (saved to the audit log)", reasonPlaceholder,
  reasonHint = "At least 5 characters. The person affected may see this.", reasonMaximumLength = 1000, typedConfirmationText, requiresStepUp = false, isBusy = false, errorMessage, children, isConfirmDisabled = false, onConfirm, onClose,
}: ConfirmActionDialogProps) {
  const [reason, setReason] = useState("");
  const [typedConfirmation, setTypedConfirmation] = useState("");
  const isReasonValid = !requiresReason || reason.trim().length >= 5;
  const isTypedConfirmationValid = !typedConfirmationText || typedConfirmation.trim() === typedConfirmationText;
  const canConfirm = isReasonValid && isTypedConfirmationValid && !isConfirmDisabled && !isBusy;

  return (
    <ModalDialog
      isOpen={isOpen}
      title={title}
      description={description}
      onClose={onClose}
      tone={tone === "danger" ? "danger" : "default"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isBusy}>
            Cancel
          </Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} onClick={() => onConfirm(reason.trim())} disabled={!canConfirm} isBusy={isBusy} iconName={requiresStepUp ? "shield24" : undefined}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {consequences.length > 0 ? (
        <ul className={styles.consequences}>
          {consequences.map((consequence) => (
            <li key={consequence}>{consequence}</li>
          ))}
        </ul>
      ) : null}
      {children}
      {requiresReason ? <TextAreaField label={reasonLabel} value={reason} onChange={(event) => setReason(event.target.value)} placeholder={reasonPlaceholder} maxLength={reasonMaximumLength} hint={reasonHint} rows={3} /> : null}
      {typedConfirmationText ? (
        <TextField label={`Type ${typedConfirmationText} to confirm`} value={typedConfirmation} onChange={(event) => setTypedConfirmation(event.target.value)} autoComplete="off" spellCheck={false} />
      ) : null}
      {requiresStepUp ? <p className={styles.stepUpNote}>You will be asked for your authenticator code before this runs.</p> : null}
      {errorMessage ? <InlineError message={errorMessage} /> : null}
    </ModalDialog>
  );
}
