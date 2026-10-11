"use client";

import Link from "next/link";

import { Spinner } from "@/components/ui/feedback";

import styles from "./paymentReturnStatus.module.css";
import { AppIcon } from "@/components/ui/appIcon";

interface PaymentReturnStatusProps {
  readonly state: "confirming" | "succeeded" | "failed";
  readonly confirmingText: string;
  readonly succeededTitle: string;
  readonly succeededText: string;
  readonly failedText: string;
  readonly continueHref: string;
  readonly continueLabel: string;
  readonly notice?: string | null;
}

export function PaymentReturnStatus({ state, confirmingText, succeededTitle, succeededText, failedText, continueHref, continueLabel, notice }: PaymentReturnStatusProps) {
  return (
    <div className={styles.card} role="status" aria-live="polite">
      {state === "confirming" ? (
        <>
          <Spinner label={confirmingText} />
          <h1 className={styles.title}>Confirming payment…</h1>
          <p className={styles.text}>{confirmingText}</p>
          {notice ? <p className={styles.text}>{notice}</p> : null}
          {notice ? (
            <Link href={continueHref} className={styles.secondary}>
              {continueLabel}
            </Link>
          ) : null}
        </>
      ) : state === "succeeded" ? (
        <>
          <span className={styles.successMark} aria-hidden="true">
            <AppIcon name="check16" size={28} />
          </span>
          <h1 className={styles.title}>{succeededTitle}</h1>
          <p className={styles.text}>{succeededText}</p>
          <Link href={continueHref} className={styles.primary}>
            {continueLabel}
          </Link>
        </>
      ) : (
        <>
          <h1 className={styles.title}>Payment not completed</h1>
          <p className={styles.text}>{failedText}</p>
          <Link href={continueHref} className={styles.secondary}>
            {continueLabel}
          </Link>
        </>
      )}
    </div>
  );
}
