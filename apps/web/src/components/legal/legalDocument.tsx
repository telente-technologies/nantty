import type { ReactNode } from "react";

import { FigmaIconTintedWithCurrentColor } from "../ui/figmaIcon";
import styles from "./legalDocument.module.css";

export interface LegalDocumentSection {
  readonly id: string;
  readonly heading: string;
  readonly paragraphs: readonly string[];
  readonly bullets?: readonly string[];
  readonly table?: { readonly columns: readonly string[]; readonly rows: readonly (readonly string[])[] };
}

interface LegalDocumentProps {
  readonly title: string;
  readonly summary: string;
  readonly versionLabel: string;
  readonly effectiveDateLabel: string;
  readonly sections: readonly LegalDocumentSection[];
  readonly isReviewedByLegal?: boolean;
  readonly archiveNotice?: string;
  readonly footer?: ReactNode;
}

export function PlaceholderLegalDocument({ title, summary, versionLabel, effectiveDateLabel, sections, isReviewedByLegal = false, archiveNotice, footer }: LegalDocumentProps) {
  return (
    <article className={`pageContainer ${styles.document}`}>
      <header className={styles.header}>
        <p className="eyebrowLabel">Legal</p>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.summary}>{summary}</p>
        <p className={styles.updated}>Version: {versionLabel} · Effective date: {effectiveDateLabel}</p>
        {archiveNotice ? <p className={styles.placeholderNotice} role="note"><span><strong>{archiveNotice}</strong></span></p> : null}
        {isReviewedByLegal ? null : (
          <p className={styles.placeholderNotice} role="note">
          <FigmaIconTintedWithCurrentColor name="warning20" size={20} />
          <span>
            <strong>Draft</strong>
          </span>
        </p>
        )}
      </header>
      <div className={styles.body}>
        <nav aria-label="On this page" className={styles.tableOfContents}>
          <p className={styles.tableOfContentsHeading}>On this page</p>
          <ol>
            {sections.map((documentSection) => (
              <li key={documentSection.id}>
                <a href={`#${documentSection.id}`}>{documentSection.heading}</a>
              </li>
            ))}
          </ol>
        </nav>
        <div className={styles.sections}>
          {sections.map((documentSection) => (
            <section key={documentSection.id} id={documentSection.id} aria-labelledby={`${documentSection.id}-heading`}>
              <h2 id={`${documentSection.id}-heading`} className={styles.sectionHeading}>
                {documentSection.heading}
              </h2>
              {documentSection.paragraphs.map((paragraph) => (
                <p key={paragraph} className={styles.paragraph}>
                  {paragraph}
                </p>
              ))}
              {documentSection.bullets ? (
                <ul className={styles.bulletList}>
                  {documentSection.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              ) : null}
              {documentSection.table ? (
                <div className={styles.tableScroller}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        {documentSection.table.columns.map((column) => (
                          <th key={column} scope="col">{column}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {documentSection.table.rows.map((row) => (
                        <tr key={row[0]}>
                          {row.map((cell, cellIndex) => (
                            <td key={`${row[0]}-${cellIndex}`}>{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </section>
          ))}
        </div>
      </div>
      {footer}
    </article>
  );
}
