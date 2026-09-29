"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

import { ZudoIcon } from "@/components/ui/zudoIcon";

import styles from "./overlayDialog.module.css";

interface OverlayDialogProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly description?: ReactNode;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly layout?: "modal" | "sidePanel";
  readonly width?: number;
}

export function OverlayDialog({ isOpen, onClose, title, description, children, footer, layout = "modal", width }: OverlayDialogProps) {
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
      aria-labelledby={titleId}
      className={layout === "sidePanel" ? `${styles.dialog} ${styles.sidePanel}` : `${styles.dialog} ${styles.modal}`}
      style={width ? { width: `min(${width}px, calc(100vw - 24px))` } : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      {isOpen ? (
        <div className={styles.frame}>
          <header className={styles.header}>
            <div>
              <h2 id={titleId}>{title}</h2>
              {description ? <p className={styles.description}>{description}</p> : null}
            </div>
            <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close">
              <ZudoIcon name="cancel20" size={18} />
            </button>
          </header>
          <div className={styles.body}>{children}</div>
          {footer ? <footer className={styles.footer}>{footer}</footer> : null}
        </div>
      ) : null}
    </dialog>
  );
}
