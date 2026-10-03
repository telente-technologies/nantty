import type { ReactNode } from "react";

import styles from "./feedback.module.css";

export { EmptyState, ErrorState, Skeleton } from "@zudomart/web-kit";

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

export function Badge({ children, tone = "neutral" }: { readonly children: ReactNode; readonly tone?: "neutral" | "brand" | "success" | "warning" | "error" }) {
  return <span className={[styles.badge, styles[`badge_${tone}`]].join(" ")}>{children}</span>;
}
