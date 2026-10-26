import Link from "next/link";

import shared from "./landingPage.module.css";
import styles from "./landingHero.module.css";
import { LandingIcon } from "./landingIcons";
import { LiveStageMockup } from "./liveStageMockup";

const heroProofPoints = ["Phone, OBS or WHIP", "Up to 10 creators on stage", "Payouts to your bank"];

export function LandingHero() {
  return (
    <section className={styles.hero} aria-labelledby="landing-hero-heading">
      <div className={styles.layout}>
        <div className={styles.copy}>
          <p className={shared.eyebrow}>Nantty Studio · for Creator Program members</p>
          <h1 id="landing-hero-heading" className={styles.heading}>
            <span className={styles.headingLine}>Go live.</span> <span className={styles.headingLine}>Get gifted.</span>{" "}
            <span className={styles.headingLine}>
              Get <span className={shared.highlight}>paid.</span>
            </span>
          </h1>
          <p className={styles.lede}>
            Studio is your creator control room. Stream from your phone or OBS, bring up to 10 creators on stage, battle for gifts and withdraw to your bank. Talk, music, gaming, classes or IRL. Selling is optional.
          </p>
          <div className={styles.actions}>
            <Link href="/login" className={shared.primaryAction}>
              Go live with Studio
              <LandingIcon name="arrowRight" size={18} strokeWidth={2.2} />
            </Link>
            <a href="#creator-program" className={shared.secondaryAction}>
              Join the Creator Program
            </a>
          </div>
          <ul className={styles.proofList}>
            {heroProofPoints.map((point) => (
              <li key={point}>
                <LandingIcon name="check" size={16} strokeWidth={2.6} className={styles.proofIcon} />
                {point}
              </li>
            ))}
          </ul>
          <p className={styles.note}>Sign in with your Nantty app account. New to the Creator Program? Apply in the Nantty app first.</p>
        </div>
        <LiveStageMockup />
      </div>
    </section>
  );
}
