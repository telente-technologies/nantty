import Link from "next/link";

import { ZudoIcon } from "@/components/ui/zudoIcon";

import { featureShowcases } from "./landingCopy.content";
import { ScreenshotInBrowserFrame, SectionIntro } from "./landingPrimitives";
import styles from "./landingFeatures.module.css";

export function FeatureShowcaseSections() {
  return (
    <>
      {featureShowcases.map((feature, featureIndex) => (
        <section key={feature.id} id={feature.id} className={featureIndex % 2 === 1 ? `${styles.featureSection} ${styles.featureSectionTinted}` : styles.featureSection} aria-labelledby={`${feature.id}-heading`}>
          <div className={featureIndex % 2 === 1 ? `${styles.container} ${styles.featureLayout} ${styles.featureLayoutReversed}` : `${styles.container} ${styles.featureLayout}`}>
            <div>
              <SectionIntro eyebrow={feature.eyebrow} headingId={`${feature.id}-heading`} heading={feature.heading} lede={feature.lede} />
              <ul className={styles.pointList}>
                {feature.points.map((point) => (
                  <li key={point}>
                    <ZudoIcon name="check16" size={14} className={styles.pointIcon} />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
            <ScreenshotInBrowserFrame src={feature.screenshot} alt={feature.screenshotAlt} address={`ads.nantty.com/${feature.id === "targeting" ? "campaigns/new" : feature.id === "billing" ? "billing" : "reports"}`} />
          </div>
        </section>
      ))}
    </>
  );
}

const reviewStates = [
  { label: "In review", tone: styles.stateInfo, text: "Checked against our policies, usually within a few hours." },
  { label: "Active", tone: styles.stateSuccess, text: "Approved and delivering while you have budget and balance." },
  { label: "Rejected", tone: styles.stateError, text: "You see the exact policy and reason. Edit the ad, or appeal once." },
];

export function PolicyAndReviewSection() {
  return (
    <section id="review" className={styles.featureSection} aria-labelledby="review-heading">
      <div className={`${styles.container} ${styles.featureLayout}`}>
        <div>
          <SectionIntro eyebrow="Policies and review" headingId="review-heading" heading="Safe for buyers, fair for every seller." lede="Counterfeits, get-rich-quick offers, miracle cures and other harmful ads are never allowed. Alcohol, health products and financial services have extra rules." />
          <ul className={styles.stateList}>
            {reviewStates.map((state) => (
              <li key={state.label}>
                <span className={`${styles.stateBadge} ${state.tone}`}>{state.label}</span>
                <span>{state.text}</span>
              </li>
            ))}
          </ul>
          <Link href="/policy" className={styles.inlineLink}>
            Read the advertising policies
            <ZudoIcon name="arrowUpRight24" size={16} />
          </Link>
        </div>
        <ScreenshotInBrowserFrame src="/screenshots/campaignsList.webp" alt="Campaigns table showing active, paused, in review and rejected campaigns with spend, results and pacing" address="ads.nantty.com/campaigns" />
      </div>
    </section>
  );
}
