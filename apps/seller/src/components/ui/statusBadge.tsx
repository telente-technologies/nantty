import type { ReactNode } from "react";

import styles from "./statusBadge.module.css";

export type StatusTone = "neutral" | "info" | "success" | "caution" | "error" | "highlight";

export function StatusBadge({ tone = "neutral", children }: { readonly tone?: StatusTone; readonly children: ReactNode }) {
  return <span className={`${styles.badge} ${styles[tone]}`}>{children}</span>;
}

export function convertSnakeCaseToLabel(value: string): string {
  const spaced = value.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
