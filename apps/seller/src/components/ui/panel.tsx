import type { ReactNode } from "react";

import styles from "./panel.module.css";

export function Panel({ title, description, actions, children, className, padded = true, headingLevel = 2 }: { readonly title?: ReactNode; readonly description?: ReactNode; readonly actions?: ReactNode; readonly children: ReactNode; readonly className?: string; readonly padded?: boolean; readonly headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <section className={[styles.panel, className ?? ""].join(" ")}>
      {title || actions ? (
        <header className={styles.header}>
          <div className={styles.titles}>
            {title ? <Heading className={styles.title}>{title}</Heading> : null}
            {description ? <p className={styles.description}>{description}</p> : null}
          </div>
          {actions ? <div className={styles.actions}>{actions}</div> : null}
        </header>
      ) : null}
      <div className={padded ? styles.body : undefined}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, description, actions, eyebrow }: { readonly title: string; readonly description?: ReactNode; readonly actions?: ReactNode; readonly eyebrow?: ReactNode }) {
  return (
    <header className={styles.pageHeader}>
      <div className={styles.titles}>
        {eyebrow ? <div className={styles.eyebrow}>{eyebrow}</div> : null}
        <h1 className={styles.pageTitle}>{title}</h1>
        {description ? <p className={styles.description}>{description}</p> : null}
      </div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
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

export function PageStack({ children }: { readonly children: ReactNode }) {
  return <div className={styles.pageStack}>{children}</div>;
}

export function ResponsiveGrid({ children, minimumColumnWidth = 260 }: { readonly children: ReactNode; readonly minimumColumnWidth?: number }) {
  return (
    <div className={styles.grid} style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${minimumColumnWidth}px), 1fr))` }}>
      {children}
    </div>
  );
}
