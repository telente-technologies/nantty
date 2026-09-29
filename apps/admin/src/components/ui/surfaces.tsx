import type { ReactNode } from "react";

import styles from "./surfaces.module.css";

export function Card({ title, actions, children, isFlush = false, className }: { readonly title?: ReactNode; readonly actions?: ReactNode; readonly children: ReactNode; readonly isFlush?: boolean; readonly className?: string }) {
  return (
    <section className={[styles.card, className].filter(Boolean).join(" ")}>
      {title || actions ? (
        <header className={styles.cardHeader}>
          {title ? <h2 className={styles.cardTitle}>{title}</h2> : <span />}
          {actions ? <div className={styles.cardActions}>{actions}</div> : null}
        </header>
      ) : null}
      <div className={isFlush ? undefined : styles.cardBody}>{children}</div>
    </section>
  );
}

export interface KeyValueItem {
  readonly label: string;
  readonly value: ReactNode;
  readonly isMono?: boolean;
}

export function KeyValueList({ items, columns = 1 }: { readonly items: readonly KeyValueItem[]; readonly columns?: 1 | 2 | 3 }) {
  return (
    <dl className={`${styles.keyValueList} ${styles[`columns${columns}`]}`}>
      {items.map((item) => (
        <div key={item.label} className={styles.keyValueRow}>
          <dt>{item.label}</dt>
          <dd className={item.isMono ? "mono" : undefined}>{item.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function SectionHeading({ children, actions }: { readonly children: ReactNode; readonly actions?: ReactNode }) {
  return (
    <div className={styles.sectionHeading}>
      <h3>{children}</h3>
      {actions}
    </div>
  );
}

export function Toolbar({ children }: { readonly children: ReactNode }) {
  return <div className={styles.toolbar}>{children}</div>;
}

export function KeyboardKey({ children }: { readonly children: ReactNode }) {
  return <kbd className={styles.keyboardKey}>{children}</kbd>;
}

export function TwoColumnLayout({ main, aside }: { readonly main: ReactNode; readonly aside: ReactNode }) {
  return (
    <div className={styles.twoColumns}>
      <div className={styles.mainColumn}>{main}</div>
      <div className={styles.asideColumn}>{aside}</div>
    </div>
  );
}
