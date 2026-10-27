import type { Metadata } from "next";
import { cookies } from "next/headers";

import { StandaloneFrame } from "@/components/shell/standaloneFrame";
import { Card, PageHeader } from "@/components/ui/surfaces";
import { prohibitedCategories, restrictedCategories, reviewStateDescriptions, type PolicySection } from "@/constants/policy.constant";
import { buildContactMailtoLink, contactEmailDisplayText } from "@/constants/contact.constant";
import { buildSessionViewFromCookies } from "@/server/adsSessionView.service";

import styles from "./policyPage.module.css";

export const metadata: Metadata = {
  title: "Advertising policies",
  description: "Learn which ads can run on Nantty, how reviews and appeals work, and the rules for restricted categories.",
  alternates: { canonical: "/policy" },
  robots: { index: true, follow: true },
  openGraph: { type: "website", siteName: "Nantty Ads", locale: "en_NG", title: "Advertising policies | Nantty Ads", description: "Learn which ads can run on Nantty, how reviews and appeals work, and the rules for restricted categories.", url: "/policy", images: [{ url: "/screenshots/overview.webp", width: 2880, height: 1800, alt: "Nantty Ads Manager" }] },
  twitter: { card: "summary_large_image", title: "Advertising policies | Nantty Ads", description: "Learn which ads can run on Nantty, how reviews and appeals work, and the rules for restricted categories.", images: ["/screenshots/overview.webp"] },
};

function PolicyList({ sections }: { readonly sections: readonly PolicySection[] }) {
  return (
    <ul className={styles.policyList}>
      {sections.map((section) => (
        <li key={section.code} id={section.code} className={styles.policyItem}>
          <h3>{section.title}</h3>
          <p className={styles.summary}>{section.summary}</p>
          <p className={styles.examplesLabel}>For example</p>
          <ul className={styles.examples}>
            {section.examples.map((example) => (
              <li key={example}>{example}</li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

export default async function PolicyPage() {
  const isSignedIn = buildSessionViewFromCookies(await cookies()) !== null;
  return (
    <StandaloneFrame showUserMenu={isSignedIn}>
      <PageHeader title="Advertising policies" description="Every ad is reviewed before it runs. These rules keep Nantty safe for buyers and fair for sellers." />
      <div className={styles.layout}>
        <nav aria-label="On this page" className={styles.toc}>
          <a href="#review">How review works</a>
          <a href="#prohibited">Not allowed</a>
          <a href="#restricted">Allowed with limits</a>
          <a href="#appeals">Appeals</a>
        </nav>
        <div className={styles.content}>
          <Card title="How review works">
            <span id="review" />
            <ol className={styles.states}>
              {reviewStateDescriptions.map((state) => (
                <li key={state.state}>
                  <strong>{state.state}</strong> — {state.description}
                </li>
              ))}
            </ol>
          </Card>
          <Card title="Not allowed" description="Ads for these are always rejected.">
            <span id="prohibited" />
            <PolicyList sections={prohibitedCategories} />
          </Card>
          <Card title="Allowed with limits" description="These need extra targeting limits or documents.">
            <span id="restricted" />
            <PolicyList sections={restrictedCategories} />
          </Card>
          <Card title="Appeals">
            <p id="appeals" className={styles.summary}>
              If you think a rejection is wrong, open the ad and choose Appeal. Explain why it follows the policy. A person reviews every appeal, usually within 24 hours. You can appeal each decision once; after that, edit the ad and it will be reviewed again.
            </p>
            <p className={styles.summary}>
              Questions about a policy? Email <a href={buildContactMailtoLink("Nantty Ads policy question")}>{contactEmailDisplayText}</a>.
            </p>
          </Card>
        </div>
      </div>
    </StandaloneFrame>
  );
}
