import { landingFeatures } from "@/constants/landingContent.constant";

import styles from "./landingFeatures.module.css";
import { LandingProductPreview } from "./landingProductPreview";

export function LandingFeatures() {
  return (
    <section id="features" className={styles.section} aria-labelledby="features-heading">
      <div className={styles.inner}>
        <div className={styles.intro}>
          <p className={styles.eyebrow}>What you can run from here</p>
          <h2 id="features-heading" className={styles.heading}>
            Everything the app does for sellers, on a bigger screen.
          </h2>
          <p className={styles.lede}>Every picture below is the real dashboard, showing a demo store&apos;s data.</p>
        </div>
        <ul className={styles.grid}>
          {landingFeatures.map((feature) => (
            <li key={feature.id} className={`${styles.card} ${feature.size === "wide" ? styles.wide : ""}`}>
              <div className={styles.cardText}>
                <h3 className={styles.cardTitle}>{feature.title}</h3>
                <p className={styles.cardDescription}>{feature.description}</p>
              </div>
              <div className={styles.screenWindow}>
                {process.env.NEXT_PUBLIC_NANTTY_STATIC_PRELAUNCH === "1" ? <LandingProductPreview title={feature.title} /> : <img src={`/screenshots/${feature.screenshot}.webp`} alt={feature.screenshotAlt} width={1440} height={900} loading="lazy" className={styles.screenshot} />}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
