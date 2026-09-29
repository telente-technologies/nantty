"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { IconButton } from "@/components/ui/button";

import styles from "./modalDialog.module.css";

interface ModalDialogProps {
  readonly isOpen: boolean;
  readonly title: string;
  readonly description?: ReactNode;
  readonly onClose: () => void;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly width?: "small" | "medium" | "large";
}

export function ModalDialog({ isOpen, title, description, onClose, children, footer, width = "medium" }: ModalDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  return (
    <dialog
      ref={dialogRef}
      className={`${styles.dialog} ${styles[width]}`}
      aria-labelledby="modal-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      {isOpen ? (
        <div className={styles.surface}>
          <header className={styles.header}>
            <div>
              <h2 id="modal-dialog-title" className={styles.title}>
                {title}
              </h2>
              {description ? <p className={styles.description}>{description}</p> : null}
            </div>
            <IconButton iconName="cancel20" label="Close" onClick={onClose} size="small" />
          </header>
          <div className={styles.body}>{children}</div>
          {footer ? <footer className={styles.footer}>{footer}</footer> : null}
        </div>
      ) : null}
    </dialog>
  );
}
