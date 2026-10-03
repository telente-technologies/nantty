import Link from "next/link";

import type { LegalPolicy, LegalPolicyVersion } from "@/content/legalPolicies.content";

import { PlaceholderLegalDocument } from "./legalDocument";
import styles from "./legalDocument.module.css";

function formatEffectiveDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

interface LegalPolicyPageProps {
  readonly policy: LegalPolicy;
  readonly shownVersion?: LegalPolicyVersion;
}

export function LegalPolicyPage({ policy, shownVersion }: LegalPolicyPageProps) {
  const version = shownVersion ?? policy.currentVersion;
  const isArchived = shownVersion !== undefined;
  return (
    <PlaceholderLegalDocument
      title={policy.title}
      summary={policy.summary}
      versionLabel={version.versionLabel}
      effectiveDateLabel={formatEffectiveDate(version.effectiveOn)}
      sections={version.sections}
      isReviewedByLegal={version.isReviewedByLegal}
      archiveNotice={isArchived ? "This is an earlier version. It is not the one that applies today." : undefined}
      footer={
        <section className={styles.versions} aria-labelledby="previous-versions-heading">
          <h2 id="previous-versions-heading" className={styles.sectionHeading}>{isArchived ? "Current version" : "View previous versions"}</h2>
          {isArchived ? (
            <p><Link href={policy.publicPath}>Read the current {policy.title.toLowerCase()}</Link></p>
          ) : policy.previousVersions.length === 0 ? (
            <p className={styles.paragraph}>There are no previous versions yet.</p>
          ) : (
            <ul className={styles.versionList}>
              {policy.previousVersions.map((previous) => (
                <li key={previous.versionLabel}>
                  <Link href={`/legal-archive/${policy.slug}/${encodeURIComponent(previous.versionLabel)}`}>Version {previous.versionLabel}</Link> <span>effective {formatEffectiveDate(previous.effectiveOn)}. {previous.changeSummary}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      }
    />
  );
}
