import type { ReactNode } from "react";

import styles from "./pageHeader.module.css";

interface PageHeaderProps {
  readonly area: string;
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly actions?: ReactNode;
  readonly meta?: ReactNode;
}

export function PageHeader({ area, title, description, actions, meta }: PageHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.headings}>
        <p className={styles.area}>{area}</p>
        <h1 className={styles.title}>{title}</h1>
        {description ? <p className={styles.description}>{description}</p> : null}
        {meta ? <div className={styles.meta}>{meta}</div> : null}
      </div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </header>
  );
}
