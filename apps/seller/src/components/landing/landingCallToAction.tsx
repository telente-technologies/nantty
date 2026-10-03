import Link from "next/link";

import styles from "./landingCallToAction.module.css";

export function LandingCallToAction({ getTheAppUrl }: { readonly getTheAppUrl: string }) {
  return (
    <section className={styles.section} aria-labelledby="cta-heading">
      <div className={styles.panel}>
        <div className={styles.copy}>
          <h2 id="cta-heading" className={styles.heading}>
            Your business is waiting. It is free to start.
          </h2>
          <p className={styles.description}>Sign in with the account you use in the Zudomart app — free for every Zudomart seller, upgrade to Pro or Business when you grow. Not selling on Zudomart yet? Start in the app, then come back here.</p>
          <div className={styles.actions}>
            <Link href="/login" className={styles.primaryAction}>
              Sign in with your Zudomart account
            </Link>
            <a href={getTheAppUrl} className={styles.secondaryAction}>
              Get the app
            </a>
          </div>
        </div>
        <div className={styles.photoColumn}>
          <img src="/photos/shopCounterOwner.webp" alt="A Zudomart seller smiling in her provisions store" width={1400} height={933} loading="lazy" className={styles.photo} />
        </div>
      </div>
    </section>
  );
}
