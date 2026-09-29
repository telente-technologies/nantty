import type { ReactNode } from "react";

import styles from "./pageHeader.module.css";

interface PageHeaderProps {
  readonly eyebrow: string;
  readonly title: ReactNode;
  readonly lede?: ReactNode;
}

export function PageHeaderWithTitleAndLede({ eyebrow, title, lede }: PageHeaderProps) {
  return (
    <header className={`pageContainer ${styles.header}`}>
      <p className="eyebrowLabel">{eyebrow}</p>
      <h1 className={styles.title}>{title}</h1>
      {lede ? <p className={styles.lede}>{lede}</p> : null}
    </header>
  );
}
