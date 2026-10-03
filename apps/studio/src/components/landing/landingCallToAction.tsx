import Link from "next/link";

import shared from "./landingPage.module.css";
import styles from "./landingCallToAction.module.css";

export function LandingCallToAction() {
  return (
    <section className={styles.cta}>
      <div className={`${styles.inner} pageContainer`}>
        <h2 className={styles.title}>Ready to go live?</h2>
        <p className={styles.body}>Sign in with your Zudomart account and start your first broadcast, whether you sell or not.</p>
        <Link href="/login" className={shared.primaryAction}>
          Log in to Studio
        </Link>
      </div>
    </section>
  );
}
