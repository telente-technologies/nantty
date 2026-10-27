import { NanttyIcon, type NanttyIconName } from "@/components/ui/nanttyIcon";

import { SectionIntro } from "./landingPrimitives";
import styles from "./landingFeatures.module.css";

const pillars: readonly { readonly iconName: NanttyIconName; readonly title: string; readonly text: string }[] = [
  { iconName: "buildingStore20", title: "Made for businesses", text: "Ads Manager is where stores and brands run full campaigns: several ad sets and ads, audiences, A/B tests, automated rules, team roles, billing and reports." },
  { iconName: "arrowUpRight24", title: "Boosting stays in the app", text: "Just want more people to see one post? Boost it from the Nantty app. Everything you boost shows up here too, on the same account." },
  { iconName: "sealCheck20", title: "Relevant, not loud", text: "Ads compete in an auction that weighs your bid and how useful the ad is to each buyer, with limits on how often one person sees it." },
];

export function WhatIsNanttyAdsSection() {
  return (
    <section className={`${styles.featureSection} ${styles.featureSectionTinted}`} aria-labelledby="about-heading">
      <div className={styles.container}>
        <SectionIntro eyebrow="What is Nantty Ads" headingId="about-heading" heading="The ad platform inside Nigeria's social marketplace." lede="Buyers on Nantty discover products through posts, reels, live streams and Mart. Nantty Ads puts your products into those same moments, then shows you the orders that followed." />
        <ul className={styles.pillarGrid}>
          {pillars.map((pillar) => (
            <li key={pillar.title} className={styles.pillar}>
              <span className={styles.pillarIcon}>
                <NanttyIcon name={pillar.iconName} size={20} />
              </span>
              <h3 className={styles.pillarTitle}>{pillar.title}</h3>
              <p className={styles.pillarText}>{pillar.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
