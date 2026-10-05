"use client";

import { ExclamationMark } from "@phosphor-icons/react";
import type { ReactNode } from "react";

import styles from "./feedback.module.css";

interface ErrorStateProps {
  readonly title?: string;
  readonly description?: string;
  readonly action?: ReactNode;
  readonly onRetry?: () => void;
  readonly retryLabel?: string;
}

export function ErrorState({ title = "Something went wrong", description, action, onRetry, retryLabel = "Try again" }: ErrorStateProps) {
  return (
    <div className={styles.errorState} role="alert">
      <div className={styles.errorMark} aria-hidden="true">
        <ExclamationMark size={16} weight="bold" />
      </div>
      <div className={styles.errorBody}>
        <p className={styles.errorTitle}>{title}</p>
        {description ? <p className={styles.errorDescription}>{description}</p> : null}
        {onRetry || action ? (
          <div className={styles.errorActions}>
            {onRetry ? (
              <button type="button" className={styles.retryButton} onClick={onRetry}>
                {retryLabel}
              </button>
            ) : null}
            {action}
          </div>
        ) : null}
      </div>
    </div>
  );
}
