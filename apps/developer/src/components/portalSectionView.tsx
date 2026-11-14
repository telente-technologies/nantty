import Link from "next/link";

import { WarningCircleIcon } from "@/components/ui/icons";
import { readDeveloperDocsHref } from "@/config/site.config";

import styles from "./portalSectionView.module.css";

export interface PortalSectionContent {
  readonly title: string;
  readonly description: string;
  readonly availability: string;
  readonly detail: string;
  readonly releaseGates: readonly string[];
  readonly workspace?: {
    readonly columns: readonly string[];
    readonly emptyTitle: string;
    readonly emptyDescription: string;
  };
}

export function PortalSectionView({ section, isDocumentationPage = false }: { readonly section: PortalSectionContent; readonly isDocumentationPage?: boolean }) {
  return (
    <section className={styles.page} aria-labelledby="section-title">
      <header className={styles.header}>
        <p className={styles.eyebrow}>Developer workspace <span aria-hidden="true">/</span> {section.title}</p>
        <h1 id="section-title" className={styles.title}>{section.title}</h1>
        <p className={styles.description}>{section.description}</p>
      </header>
      <div className={styles.unavailable} role="status">
        <WarningCircleIcon size={17} aria-hidden="true" />
        <div><strong>{section.availability}</strong><span>{section.detail}</span></div>
      </div>
      {section.workspace ? (
        <section className={styles.workspace} aria-label={`${section.title} records`}>
          <div className={styles.tableScroll}>
            <table>
              <thead><tr>{section.workspace.columns.map((column) => <th scope="col" key={column}>{column}</th>)}</tr></thead>
              <tbody><tr><td colSpan={section.workspace.columns.length}>
                <div className={styles.emptyState}>
                  <h2>{section.workspace.emptyTitle}</h2>
                  <p>{section.workspace.emptyDescription}</p>
                </div>
              </td></tr></tbody>
            </table>
          </div>
        </section>
      ) : null}
      <details className={styles.requirements}>
        <summary>Security and release requirements <span>{section.releaseGates.length} items</span></summary>
        <ul>{section.releaseGates.map((gate) => <li key={gate}>{gate}</li>)}</ul>
      </details>
      <p className={styles.nextStep}>
        {isDocumentationPage
          ? "These are release requirements, not a published or callable public API contract."
          : <>Review the <Link href={readDeveloperDocsHref()}>API release and security requirements</Link> before implementing an integration.</>}
      </p>
    </section>
  );
}
