import type { ReactNode } from "react";

import styles from "./feedback.module.css";

export function Spinner({ label = "Loading" }: { readonly label?: string }) {
  return (
    <span className={styles.spinnerRow} role="status">
      <span className={styles.spinner} aria-hidden="true" />
      <span className="visuallyHidden">{label}</span>
    </span>
  );
}

export function InlineSpinner({ label = "Loading" }: { readonly label?: string }) {
  return (
    <span className={styles.inlineRow} role="status">
      <span className={styles.spinnerSmall} aria-hidden="true" />
      <span className={styles.inlineLabel}>{label}</span>
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  readonly icon?: ReactNode;
  readonly title: string;
  readonly description?: string;
  readonly action?: ReactNode;
}) {
  return (
    <div className={styles.emptyState}>
      {icon ? <span className={styles.emptyIcon} aria-hidden="true">{icon}</span> : null}
      <h2 className={styles.emptyTitle}>{title}</h2>
      {description ? <p className={styles.emptyDescription}>{description}</p> : null}
      {action ? <div className={styles.emptyAction}>{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  action,
}: {
  readonly title?: string;
  readonly description?: string;
  readonly action?: ReactNode;
}) {
  return (
    <div className={styles.errorState} role="alert">
      <div className={styles.errorMark} aria-hidden="true">
        !
      </div>
      <div className={styles.errorBody}>
        <p className={styles.errorTitle}>{title}</p>
        {description ? <p className={styles.errorDescription}>{description}</p> : null}
        {action ? <div className={styles.emptyAction}>{action}</div> : null}
      </div>
    </div>
  );
}

export function Badge({ children, tone = "neutral" }: { readonly children: ReactNode; readonly tone?: "neutral" | "brand" | "success" | "warning" | "error" }) {
  return <span className={[styles.badge, styles[`badge_${tone}`]].join(" ")}>{children}</span>;
}
