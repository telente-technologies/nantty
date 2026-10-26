import Image from "next/image";

import { NanttyCountdown } from "./nanttyCountdown";
import { NanttyWaitlistForm } from "./nanttyWaitlistForm";
import { nanttyLaunchTargets } from "./nantty.config";
import styles from "./nanttyLanding.module.css";

export function NanttyPrelaunchSection() {
  return (
    <>
      <section className={styles.milestonesSection} aria-labelledby="nantty-milestones-heading">
        <div className={styles.pageContainer}>
          <div className={styles.sectionHeading}>
            <span className={styles.eyebrow}>LAUNCH TIMELINE</span>
            <h2 id="nantty-milestones-heading">Two milestones ahead.</h2>
            <p>Dates are planning targets and will be confirmed before public launch.</p>
          </div>
          <div className={styles.milestoneGrid}>
            <article className={styles.milestoneCard}>
              <div><span>EARLY BETA</span><h3>{nanttyLaunchTargets.earlyBeta.displayDate}</h3><p>{nanttyLaunchTargets.earlyBeta.note}</p></div>
              <NanttyCountdown target={nanttyLaunchTargets.earlyBeta.date} label="early beta" />
            </article>
            <article className={`${styles.milestoneCard} ${styles.milestoneDark}`}>
              <div><span>PUBLIC LAUNCH</span><h3>{nanttyLaunchTargets.publicLaunch.displayDate}</h3><p>{nanttyLaunchTargets.publicLaunch.note}</p></div>
              <NanttyCountdown target={nanttyLaunchTargets.publicLaunch.date} label="public launch" />
            </article>
          </div>
        </div>
      </section>
      <section className={styles.waitlistSection} id="waitlist" aria-labelledby="nantty-waitlist-heading">
        <div className={`${styles.pageContainer} ${styles.waitlistPanel}`}>
          <div className={styles.waitlistIntro}>
            <Image src="/brand/nantty-icon.png" alt="" width={46} height={46} />
            <span className={styles.eyebrow}>LAUNCH UPDATES</span>
            <h2 id="nantty-waitlist-heading">Keep me posted.</h2>
            <p>Join the list for occasional launch updates. Signup stays disabled until the Google Sheet connection and privacy notice are ready.</p>
          </div>
          <NanttyWaitlistForm />
        </div>
      </section>
    </>
  );
}
