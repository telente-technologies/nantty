import Link from "next/link";

import shared from "./landingPage.module.css";
import styles from "./landingHero.module.css";

export function LandingHero() {
  return (
    <section className={styles.hero} aria-labelledby="landing-hero-heading">
      <div className={styles.layout}>
        <div className={styles.copy}>
          <p className={shared.eyebrow}>Zudomart Studio</p>
          <h1 id="landing-hero-heading" className={styles.title}>
            Your stage, on air.
          </h1>
          <p className={styles.lede}>
            Studio is where Zudomart creators go live: talk shows, music, gaming with OBS, IRL and classes. Battle with guests, earn gifts and subscriptions, and sell too if you want to.
          </p>
          <div className={styles.actions}>
            <Link href="/login" className={shared.primaryAction}>
              Log in to Studio
            </Link>
            <Link href="https://zudomart.com/welcome" className={shared.secondaryAction}>
              Open Zudomart
            </Link>
          </div>
          <p className={styles.note}>Creator Program members can go live. Studio uses your Zudomart account.</p>
        </div>

        <div className={styles.stage} aria-hidden="true">
          <div className={styles.stageFrame}>
            <span className={styles.stageBadge}>
              <span className={styles.stageDot} />
              LIVE
            </span>
            <span className={styles.stageSource}>Gaming · OBS</span>
            <span className={styles.stageLogo}>z</span>
            <div className={styles.stageLowerThird}>
              <p className={styles.stageName}>Temitope Adeyemi</p>
              <p className={styles.stageHandle}>@temi.creates</p>
            </div>
            <span className={styles.stageTicker}>Gift goal: 7.4K / 10K coins</span>
          </div>
          <div className={styles.stageBar}>
            <span className={styles.stageMetric}>
              <span className={styles.stageMetricLabel}>Viewers</span>
              <span className={styles.stageMetricValue}>1.2K</span>
            </span>
            <span className={styles.stageMetric}>
              <span className={styles.stageMetricLabel}>Gifts</span>
              <span className={styles.stageMetricValue}>640</span>
            </span>
            <span className={styles.stageMetric}>
              <span className={styles.stageMetricLabel}>Subscribers</span>
              <span className={styles.stageMetricValue}>31</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
