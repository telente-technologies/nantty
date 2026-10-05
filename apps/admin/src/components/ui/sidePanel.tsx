"use client";

import { useEffect, useRef, type ReactNode } from "react";

import styles from "./sidePanel.module.css";
import { ZudoIcon } from "./zudoIcon";

interface SidePanelProps {
  readonly isOpen: boolean;
  readonly title: ReactNode;
  readonly subtitle?: ReactNode;
  readonly onClose: () => void;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly width?: "regular" | "wide";
}

export function SidePanel({ isOpen, title, subtitle, onClose, children, footer, width = "regular" }: SidePanelProps) {
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !document.querySelector("dialog[open]")) onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      previouslyFocused?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  return (
    <>
      <button type="button" className={styles.scrim} aria-label="Close details" tabIndex={-1} onClick={onClose} />
      <aside ref={panelRef} className={`${styles.panel} ${styles[width]}`} tabIndex={-1} aria-label={typeof title === "string" ? title : "Details"}>
        <header className={styles.header}>
          <div className={styles.headings}>
            <h2 className={styles.title}>{title}</h2>
            {subtitle ? <div className={styles.subtitle}>{subtitle}</div> : null}
          </div>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close details (Esc)">
            <ZudoIcon name="cancel20" size={16} />
          </button>
        </header>
        <div className={styles.body}>{children}</div>
        {footer ? <footer className={styles.footer}>{footer}</footer> : null}
      </aside>
    </>
  );
}
