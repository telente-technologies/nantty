import Link from "next/link";

import styles from "./portalSectionView.module.css";

export interface PortalSectionContent {
  readonly title: string;
  readonly description: string;
  readonly availability: string;
  readonly detail: string;
}

export function PortalSectionView({ section }: { readonly section: PortalSectionContent }) {
  return (
    <section className={styles.page} aria-labelledby="section-title">
      <header className={styles.header}>
        <p className={styles.eyebrow}>Isolated test environment</p>
        <h1 id="section-title" className={styles.title}>{section.title}</h1>
        <p className={styles.description}>{section.description}</p>
      </header>
      <div className={styles.unavailable} role="status">
        <span className={styles.statusMark} aria-hidden="true" />
        <div><h2>{section.availability}</h2><p>{section.detail}</p></div>
      </div>
      <p className={styles.nextStep}>Review the <Link href="/docs">sandbox environment boundary</Link> before connecting any integration.</p>
    </section>
  );
}
