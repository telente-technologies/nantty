import type { ReactNode } from "react";

import { Button } from "./button";
import styles from "./feedback.module.css";
import { ZudoIcon } from "./zudoIcon";

export function InlineError({ message }: { readonly message: string }) {
  return (
    <p className={styles.inlineError} role="alert">
      <ZudoIcon name="warning20" size={14} />
      {message}
    </p>
  );
}

export function ErrorBlock({ message, onRetry }: { readonly message: string; readonly onRetry?: () => void }) {
  return (
    <div className={styles.errorBlock} role="alert">
      <ZudoIcon name="warning20" size={18} />
      <p>{message}</p>
      {onRetry ? (
        <Button size="small" onClick={onRetry} iconName="refresh20">
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function LoadingBlock({ label = "Loading…", lines = 4 }: { readonly label?: string; readonly lines?: number }) {
  return (
    <div className={styles.loadingBlock} role="status" aria-live="polite">
      <span className="visuallyHidden">{label}</span>
      {Array.from({ length: lines }, (_, index) => (
        <span key={index} className={styles.loadingLine} style={{ width: `${90 - index * 12}%` }} />
      ))}
    </div>
  );
}

export function EmptyState({ title, description, action }: { readonly title: string; readonly description?: ReactNode; readonly action?: ReactNode }) {
  return (
    <div className={styles.emptyState}>
      <p className={styles.emptyTitle}>{title}</p>
      {description ? <p className={styles.emptyDescription}>{description}</p> : null}
      {action}
    </div>
  );
}

export function NoticeBanner({ tone = "info", title, children }: { readonly tone?: "info" | "caution" | "danger" | "success"; readonly title?: string; readonly children: ReactNode }) {
  return (
    <div className={`${styles.notice} ${styles[tone]}`} role={tone === "danger" ? "alert" : "status"}>
      {title ? <p className={styles.noticeTitle}>{title}</p> : null}
      <div>{children}</div>
    </div>
  );
}
