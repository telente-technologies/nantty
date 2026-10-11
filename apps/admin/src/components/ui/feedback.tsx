import type { ReactNode } from "react";

import { ErrorState, resolveCallerErrorCopy, type ErrorStateVariant } from "@zudomart/web-kit";

import styles from "./feedback.module.css";
import type { ZudoIconName } from "@/constants/zudoIconNames.constant";

import { ZudoIcon } from "./zudoIcon";

export function InlineError({ message }: { readonly message: string }) {
  return (
    <p className={styles.inlineError} role="alert">
      <ZudoIcon name="warning20" size={14} />
      {message}
    </p>
  );
}

export function ErrorBlock({ message, onRetry, error, title, variant = "inline" }: { readonly message?: string; readonly onRetry?: () => void; readonly error?: unknown; readonly title?: string; readonly variant?: ErrorStateVariant }) {
  const copy = resolveCallerErrorCopy(error, message);
  return <ErrorState variant={variant} error={error} kind={copy.kind} title={title} description={copy.description} onRetry={onRetry} />;
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

export function EmptyState({ title, description, action, iconName = "squaresFour24" }: { readonly title: string; readonly description?: ReactNode; readonly action?: ReactNode; readonly iconName?: ZudoIconName }) {
  return (
    <div className={styles.emptyState}>
      <span className={styles.emptyIcon} aria-hidden="true">
        <ZudoIcon name={iconName} size={24} />
      </span>
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
