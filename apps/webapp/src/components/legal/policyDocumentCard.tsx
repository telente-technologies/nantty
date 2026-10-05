import { DocumentIcon, ExternalLinkIcon } from "@/components/ui/icons";
import type { PolicyVersionSummary } from "@/types/policyUpdate.type";

import styles from "./policyDocumentCard.module.css";
import { formatPolicyEffectiveDate, hasPolicyTakenEffect, listPolicyHighlights } from "./policyHighlights.util";

export function PolicyDocumentCard({ version }: { readonly version: PolicyVersionSummary }) {
  const effectiveLabel = `${hasPolicyTakenEffect(version) ? "Effective since" : "Effective"} ${formatPolicyEffectiveDate(version.effectiveAt)}`;
  return (
    <article className={styles.documentCard} aria-label={version.title}>
      <div className={styles.documentHeader}>
        <span className={styles.documentIcon} aria-hidden="true">
          <DocumentIcon size={20} />
        </span>
        <div className={styles.documentHeading}>
          <h3 className={styles.documentTitle}>{version.title}</h3>
          <p className={styles.documentMeta}>
            Version {version.versionLabel} · {effectiveLabel}
          </p>
        </div>
        {version.isMaterialChange ? <span className={styles.importantChip}>Important change</span> : null}
      </div>
      <h4 className={styles.whatChangedLabel}>What changed</h4>
      <ul className={styles.highlightList}>
        {listPolicyHighlights(version).map((highlight) => (
          <li key={highlight}>{highlight}</li>
        ))}
      </ul>
      <a className={styles.readLink} href={version.documentUrl} target="_blank" rel="noreferrer">
        Read full {version.title}
        <ExternalLinkIcon size={15} />
        <span className="visuallyHidden"> (opens in a new tab)</span>
      </a>
    </article>
  );
}
