"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

import styles from "./modalDialog.module.css";
import { ZudoIcon } from "./zudoIcon";

interface ModalDialogProps {
  readonly isOpen: boolean;
  readonly title: string;
  readonly description?: ReactNode;
  readonly onClose: () => void;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly width?: "narrow" | "medium" | "wide";
  readonly tone?: "default" | "danger" | "secure";
  readonly isDismissible?: boolean;
}

export function ModalDialog({ isOpen, title, description, onClose, children, footer, width = "medium", tone = "default", isDismissible = true }: ModalDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  return (
    <dialog
      ref={dialogRef}
      className={`${styles.dialog} ${styles[width]} ${styles[tone]}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (isDismissible) onClose();
      }}
    >
      {isOpen ? (
        <div className={styles.surface}>
          <header className={styles.header}>
            <div>
              <h2 id={titleId} className={styles.title}>
                {title}
              </h2>
              {description ? <div className={styles.description}>{description}</div> : null}
            </div>
            {isDismissible ? (
              <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close">
                <ZudoIcon name="cancel20" size={16} />
              </button>
            ) : null}
          </header>
          <div className={styles.body}>{children}</div>
          {footer ? <footer className={styles.footer}>{footer}</footer> : null}
        </div>
      ) : null}
    </dialog>
  );
}
