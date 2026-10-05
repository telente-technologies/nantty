"use client";

import { useState } from "react";

import styles from "./copyField.module.css";

export const copyGridClassName = styles.copyGrid;

export function CopyField({ label, value, masked = false }: { readonly label: string; readonly value: string; readonly masked?: boolean }) {
  const [revealed, setRevealed] = useState(!masked);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
    setTimeout(() => setCopyStatus("idle"), 1600);
  }

  return (
    <div className={styles.copyField}>
      <span className={styles.copyLabel}>{label}</span>
      <div className={styles.copyValueRow}>
        <code className={styles.copyValue}>{revealed ? value : "••••••••••••••••••••"}</code>
        {masked ? (
          <button type="button" className={styles.copyAction} onClick={() => setRevealed((current) => !current)} aria-pressed={revealed} aria-label={revealed ? `Hide ${label}` : `Reveal ${label}`}>
            {revealed ? "Hide" : "Reveal"}
          </button>
        ) : null}
        <button type="button" className={styles.copyAction} onClick={copy} aria-label={`Copy ${label}`}>
          {copyStatus === "copied" ? "Copied" : copyStatus === "failed" ? "Copy failed" : "Copy"}
        </button>
      </div>
    </div>
  );
}
