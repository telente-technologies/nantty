import { landingFeatures } from "@/constants/landingContent.constant";

import styles from "./landingFeatures.module.css";

export function LandingFeatures() {
  return (
    <section id="features" className={styles.section} aria-labelledby="features-heading">
      <div className={styles.inner}>
        <div className={styles.intro}>
          <p className={styles.eyebrow}>What you can run from here</p>
          <h2 id="features-heading" className={styles.heading}>
            Everything the app does for sellers, on a bigger screen.
          </h2>
          <p className={styles.lede}>Products, orders and money stay connected to the same account you use in the Nantty app.</p>
        </div>
        <ul className={styles.grid}>
          {landingFeatures.map((feature) => (
            <li key={feature.id} className={`${styles.card} ${feature.size === "wide" ? styles.wide : ""}`}>
              <div className={styles.cardText}>
                <h3 className={styles.cardTitle}>{feature.title}</h3>
                <p className={styles.cardDescription}>{feature.description}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
