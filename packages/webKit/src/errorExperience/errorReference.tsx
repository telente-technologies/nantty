/** @jsxRuntime automatic */
/** @jsxImportSource react */
"use client";

import { useState } from "react";

import { ErrorIcon } from "./errorIcons";
import styles from "./errorState.module.css";

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function formatErrorReference(code: string | undefined, reference: string | undefined): string {
  return [reference ? `Ref ${reference}` : null, code ? `Code ${code}` : null].filter(Boolean).join(" · ");
}

export function ErrorReference({ code, reference }: { readonly code?: string; readonly reference?: string }) {
  const [copied, setCopied] = useState(false);
  const text = formatErrorReference(code, reference);
  if (!text) return null;
  const copy = async () => {
    if (await copyText(text)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  };
  return (
    <p className={styles.reference}>
      <span className={styles.referenceText}>{text}</span>
      <button type="button" className={styles.referenceCopy} onClick={() => void copy()} aria-label={copied ? "Reference copied" : "Copy reference for support"}>
        {copied ? <ErrorIcon name="check" size={14} weight="bold" /> : <ErrorIcon name="copy" size={14} weight="regular" />}
        <span>{copied ? "Copied" : "Copy"}</span>
      </button>
      <span className={styles.visuallyHidden} role="status" aria-live="polite">
        {copied ? "Reference copied" : ""}
      </span>
    </p>
  );
}
