import { FigmaIconTintedWithCurrentColor } from "../ui/figmaIcon";
import styles from "./legalDocument.module.css";

export interface LegalDocumentSection {
  readonly id: string;
  readonly heading: string;
  readonly paragraphs: readonly string[];
}

interface LegalDocumentProps {
  readonly title: string;
  readonly summary: string;
  readonly lastUpdatedLabel: string;
  readonly sections: readonly LegalDocumentSection[];
}

export function PlaceholderLegalDocument({ title, summary, lastUpdatedLabel, sections }: LegalDocumentProps) {
  return (
    <article className={`pageContainer ${styles.document}`}>
      <header className={styles.header}>
        <p className="eyebrowLabel">Legal</p>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.summary}>{summary}</p>
        <p className={styles.updated}>{lastUpdatedLabel}</p>
        <p className={styles.placeholderNotice} role="note">
          <FigmaIconTintedWithCurrentColor name="warning20" size={20} />
          <span>
            <strong>Draft placeholder.</strong> This text is a starting outline and has not been reviewed by a lawyer. The Zudomart team must replace it with approved legal copy before launch.
          </span>
        </p>
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
            </section>
          ))}
        </div>
      </div>
    </article>
  );
}
