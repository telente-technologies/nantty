import type { ReactNode } from "react";

import { ZudoIcon, type ZudoIconName } from "@/components/ui/zudoIcon";

import styles from "./feedback.module.css";

export function EmptyState({ iconName = "squaresFour24", title, description, action }: { readonly iconName?: ZudoIconName; readonly title: string; readonly description?: ReactNode; readonly action?: ReactNode }) {
  return (
    <div className={styles.emptyState}>
      <span className={styles.emptyIcon}>
        <ZudoIcon name={iconName} size={22} />
      </span>
      <h2>{title}</h2>
      {description ? <p className={styles.emptyDescription}>{description}</p> : null}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { readonly message: string; readonly onRetry?: () => void }) {
  return (
    <div className={styles.errorState} role="alert">
      <ZudoIcon name="warning20" size={18} />
      <span>{message}</span>
      {onRetry ? (
        <button type="button" className={styles.retryButton} onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}

export type NoticeTone = "info" | "success" | "caution" | "error";

const iconByNoticeTone: Record<NoticeTone, ZudoIconName> = { info: "question24", success: "check16", caution: "warning20", error: "warning20" };

export function InlineNotice({ tone = "info", title, children, action }: { readonly tone?: NoticeTone; readonly title?: string; readonly children?: ReactNode; readonly action?: ReactNode }) {
  return (
    <div className={`${styles.notice} ${styles[tone]}`} role={tone === "error" ? "alert" : "status"}>
      <ZudoIcon name={iconByNoticeTone[tone]} size={16} className={styles.noticeIcon} />
      <div className={styles.noticeBody}>
        {title ? <strong>{title}</strong> : null}
        {children ? <div>{children}</div> : null}
      </div>
      {action}
    </div>
  );
}

export function LoadingBlock({ label = "Loading", height = 160 }: { readonly label?: string; readonly height?: number }) {
  return (
    <div className={styles.loadingBlock} style={{ height }} role="status" aria-live="polite">
      <span className="visuallyHidden">{label}</span>
    </div>
  );
}

export function SkeletonLine({ width = "100%" }: { readonly width?: string | number }) {
  return <span className={styles.skeletonLine} style={{ width }} aria-hidden />;
}
