import Image from "next/image";

import { OfficialStoreBadges } from "@nantty/web-kit";

import { storeLinks } from "@/constants/contact.constant";

import styles from "./landingCallToAction.module.css";
import { PrelaunchLoginAction } from "./prelaunchLoginAction";

export function LandingCallToAction() {
  return (
    <section className={styles.section} aria-labelledby="cta-heading">
      <div className={styles.panel}>
        <div className={styles.copy}>
          <h2 id="cta-heading" className={styles.heading}>
            Your audience is waiting. Go live tonight.
          </h2>
          <p className={styles.description}>Sign in with the account you use in the Nantty app. Not in the Creator Program yet? Apply in the app, then come back here to go live.</p>
          <div className={styles.actions}>
            <PrelaunchLoginAction className={styles.primaryAction}>
              Go live with Studio
            </PrelaunchLoginAction>
            <a href="#creator-program" className={styles.secondaryAction}>
              Join the Creator Program
            </a>
          </div>
          <OfficialStoreBadges links={storeLinks} className={styles.storeBadges} />
        </div>
        <div className={styles.photoColumn}>
          <Image src="/photos/podcastDeskHost.webp" alt="A creator in headphones talking into a microphone at his desk" width={1000} height={1250} sizes="(max-width: 960px) 100vw, 520px" className={styles.photo} />
        </div>
      </div>
    </section>
  );
}
