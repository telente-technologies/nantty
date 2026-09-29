import type { ReactNode } from "react";

import styles from "./surfaces.module.css";

export function Card({ title, description, actions, children, padded = true, className }: { readonly title?: ReactNode; readonly description?: ReactNode; readonly actions?: ReactNode; readonly children?: ReactNode; readonly padded?: boolean; readonly className?: string }) {
  return (
    <section className={[styles.card, className ?? ""].join(" ")}>
      {title || actions ? (
        <header className={styles.cardHeader}>
          <div>
            {title ? <h2>{title}</h2> : null}
            {description ? <p className={styles.cardDescription}>{description}</p> : null}
          </div>
          {actions ? <div className={styles.cardActions}>{actions}</div> : null}
        </header>
      ) : null}
      <div className={padded ? styles.cardBody : undefined}>{children}</div>
    </section>
  );
}

export function PageHeader({ eyebrow, title, description, actions }: { readonly eyebrow?: ReactNode; readonly title: ReactNode; readonly description?: ReactNode; readonly actions?: ReactNode }) {
  return (
    <header className={styles.pageHeader}>
      <div className={styles.pageHeading}>
        {eyebrow ? <div className={styles.eyebrow}>{eyebrow}</div> : null}
        <h1>{title}</h1>
        {description ? <p className={styles.pageDescription}>{description}</p> : null}
      </div>
      {actions ? <div className={styles.pageActions}>{actions}</div> : null}
    </header>
  );
}

export function KeyValueList({ items }: { readonly items: readonly { readonly label: string; readonly value: ReactNode }[] }) {
  return (
    <dl className={styles.keyValueList}>
      {items.map((item) => (
        <div key={item.label} className={styles.keyValueRow}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Toolbar({ children }: { readonly children: ReactNode }) {
  return <div className={styles.toolbar}>{children}</div>;
}
