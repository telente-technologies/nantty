import type { ReactNode } from "react";

import { ZudoIcon, type ZudoIconName } from "@/components/ui/zudoIcon";

import styles from "./feedback.module.css";

export function EmptyState({ iconName = "squaresFour24", title, description, action }: { readonly iconName?: ZudoIconName; readonly title: string; readonly description?: ReactNode; readonly action?: ReactNode }) {
  return (
    <div className={styles.emptyState}>
      <span className={styles.emptyIcon}>
        <ZudoIcon name={iconName} size={24} />
      </span>
      <p className={styles.emptyTitle}>{title}</p>
      {description ? <p className={styles.emptyDescription}>{description}</p> : null}
      {action ? <div className={styles.emptyAction}>{action}</div> : null}
    </div>
  );
}

export function Callout({ tone = "info", title, children, action }: { readonly tone?: "info" | "caution" | "error" | "success"; readonly title?: string; readonly children?: ReactNode; readonly action?: ReactNode }) {
  const iconName: ZudoIconName = tone === "success" ? "sealCheck20" : tone === "info" ? "question24" : "warning20";
  return (
    <div className={`${styles.callout} ${styles[tone]}`} role={tone === "error" ? "alert" : undefined}>
      <ZudoIcon name={iconName} size={18} />
      <div className={styles.calloutBody}>
        {title ? <p className={styles.calloutTitle}>{title}</p> : null}
        {children ? <div>{children}</div> : null}
      </div>
      {action ? <div className={styles.calloutAction}>{action}</div> : null}
    </div>
  );
}

export function LoadingBlock({ label = "Loading" }: { readonly label?: string }) {
  return (
    <div className={styles.loading} role="status">
      <span className={styles.spinner} aria-hidden="true" />
      <span>{label}…</span>
    </div>
  );
}

export function StatTile({ label, value, detail, tone = "neutral" }: { readonly label: string; readonly value: ReactNode; readonly detail?: ReactNode; readonly tone?: "neutral" | "positive" | "negative" | "caution" }) {
  return (
    <div className={styles.statTile}>
      <p className={styles.statLabel}>{label}</p>
      <p className={styles.statValue}>{value}</p>
      {detail ? <p className={`${styles.statDetail} ${styles[`detail_${tone}`]}`}>{detail}</p> : null}
    </div>
  );
}
