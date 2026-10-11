import Link from "next/link";
import type { ReactNode } from "react";

import styles from "./studioPage.module.css";

export function PageHeader({ title, subtitle, action }: { readonly title: string; readonly subtitle?: ReactNode; readonly action?: ReactNode }) {
  return (
    <header className={styles.header}>
      <div>
        <h1 className={styles.title}>{title}</h1>
        {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
      </div>
      {action ? <div className={styles.headerAction}>{action}</div> : null}
    </header>
  );
}

export function Card({ title, action, children, id }: { readonly title?: string; readonly action?: ReactNode; readonly children: ReactNode; readonly id?: string }) {
  return (
    <section className={styles.card} id={id} aria-label={title}>
      {title || action ? (
        <div className={styles.cardHead}>
          {title ? <h2 className={styles.cardTitle}>{title}</h2> : <span />}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export interface Stat {
  readonly label: string;
  readonly value: string;
  readonly hint?: string;
}

export function StatGrid({ stats, label }: { readonly stats: readonly Stat[]; readonly label: string }) {
  return (
    <ul className={styles.stats} aria-label={label}>
      {stats.map((stat) => (
        <li key={stat.label} className={styles.stat}>
          <span className={styles.statLabel}>{stat.label}</span>
          <strong className={styles.statValue}>{stat.value}</strong>
          {stat.hint ? <span className={styles.statHint}>{stat.hint}</span> : null}
        </li>
      ))}
    </ul>
  );
}

export interface NextAction {
  readonly key: string;
  readonly title: string;
  readonly detail: string;
  readonly href: string;
  readonly label: string;
  readonly tone?: "urgent" | "normal";
  readonly external?: boolean;
}

export function NextActionList({ actions }: { readonly actions: readonly NextAction[] }) {
  return (
    <ul className={styles.actions}>
      {actions.map((action) => (
        <li key={action.key} className={styles.action} data-tone={action.tone ?? "normal"}>
          <div className={styles.actionText}>
            <strong>{action.title}</strong>
            <span className={styles.muted}>{action.detail}</span>
          </div>
          {action.external ? (
            <a href={action.href} className={styles.actionLink} target="_blank" rel="noopener noreferrer">{action.label}</a>
          ) : (
            <Link href={action.href} className={styles.actionLink}>{action.label}</Link>
          )}
        </li>
      ))}
    </ul>
  );
}

export function Muted({ children }: { readonly children: ReactNode }) {
  return <p className={styles.muted}>{children}</p>;
}

export function DataRows({ rows }: { readonly rows: readonly { readonly key: string; readonly label: ReactNode; readonly value: ReactNode; readonly detail?: ReactNode }[] }) {
  return (
    <ul className={styles.rows}>
      {rows.map((row) => (
        <li key={row.key} className={styles.row}>
          <span className={styles.rowLabel}>
            <span>{row.label}</span>
            {row.detail ? <span className={styles.muted}>{row.detail}</span> : null}
          </span>
          <strong className={styles.rowValue}>{row.value}</strong>
        </li>
      ))}
    </ul>
  );
}

export const pageStyles = styles;
