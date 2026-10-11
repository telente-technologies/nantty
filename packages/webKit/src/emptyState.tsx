/** @jsxRuntime automatic */
/** @jsxImportSource react */
import type { ReactNode } from "react";

import { emptyCatalog, type EmptyKind } from "./errorExperience/emptyCatalog";
import { ErrorIcon } from "./errorExperience/errorIcons";
import styles from "./feedback.module.css";

interface EmptyStateProps {
  readonly kind?: EmptyKind;
  readonly icon?: ReactNode;
  readonly title?: string;
  readonly description?: ReactNode;
  readonly action?: ReactNode;
  readonly variant?: "section" | "compact";
}

export function EmptyState({ kind = "generic", icon, title, description, action, variant = "section" }: EmptyStateProps) {
  const preset = emptyCatalog[kind];
  const body = description ?? (title && kind === "generic" ? null : preset.description);
  return (
    <div className={`${styles.emptyState} ${variant === "compact" ? styles.emptyCompact : ""}`}>
      <span className={styles.emptyIcon} aria-hidden="true">
        {icon ?? <ErrorIcon name={preset.icon} size={variant === "compact" ? 24 : 30} />}
      </span>
      <h2 className={styles.emptyTitle}>{title ?? preset.title}</h2>
      {body ? <p className={styles.emptyDescription}>{body}</p> : null}
      {action ? <div className={styles.emptyAction}>{action}</div> : null}
    </div>
  );
}
