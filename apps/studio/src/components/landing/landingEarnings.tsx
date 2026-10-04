import Link from "next/link";

import { LandingIcon, type LandingIconName } from "./landingIcons";
import shared from "./landingPage.module.css";
import styles from "./landingEarnings.module.css";

const earningStreams: readonly { title: string; figure: string; description: string; icon: LandingIconName }[] = [
  { title: "Gifts", figure: "Every gift counts", description: "Viewers send gifts during your live and battles. Coins are added to your earnings as they land, with top gifters listed per live.", icon: "gift" },
  { title: "Fan subscriptions", figure: "You keep 80%", description: "Fans subscribe monthly for badges and perks you choose. You keep 80% of each subscription after app store fees.", icon: "star" },
  { title: "Ad revenue share", figure: "For eligible content", description: "Eligible replays and clips earn a share of ad revenue. Live ads only run if you turn them on. Zudomart shares revenue; it does not pay per view.", icon: "megaphone" },
];

const payoutFacts = ["Verify your ID once, then withdraw any time", "A small flat fee per withdrawal, shown before you confirm", "Nigerian bank transfers usually arrive within minutes", "Your first withdrawal gets one quick safety review"];

export function LandingEarnings() {
  return (
    <section id="earnings" className={`${shared.section} ${styles.section}`} aria-labelledby="earnings-heading">
      <div className={shared.inner}>
        <div className={styles.intro}>
          <p className={styles.eyebrow}>Earnings</p>
          <h2 id="earnings-heading" className={styles.heading}>
            Get paid for every <span className={styles.accent}>gift.</span>
          </h2>
          <p className={styles.lede}>Three ways to earn from the lives you already run, one balance and payouts straight to your bank. No hidden cuts, no surprise fees.</p>
        </div>
        <div className={styles.layout}>
          <ul className={styles.streams}>
            {earningStreams.map((stream) => (
              <li key={stream.title} className={styles.streamCard}>
                <span className={styles.streamIcon}>
                  <LandingIcon name={stream.icon} size={22} />
                </span>
                <h3 className={styles.streamTitle}>{stream.title}</h3>
                <p className={styles.streamFigure}>{stream.figure}</p>
                <p className={styles.streamDescription}>{stream.description}</p>
              </li>
            ))}
          </ul>
          <article className={styles.payoutCard} aria-labelledby="payout-heading">
            <p className={styles.payoutLabel}>Available to withdraw · example</p>
            <p className={styles.payoutBalance}>₦212,400.00</p>
            <div className={styles.bankRow}>
              <span className={styles.bankIcon}>
                <LandingIcon name="bank" size={20} />
              </span>
              <span className={styles.bankText}>
                <strong>Your bank account</strong>
                <span>Savings ••4821</span>
              </span>
              <span className={styles.verifiedChip}>
                <LandingIcon name="check" size={12} strokeWidth={3} />
                Verified
              </span>
            </div>
            <h3 id="payout-heading" className={styles.payoutHeading}>
              Payouts to your bank
            </h3>
            <ul className={styles.payoutFacts}>
              {payoutFacts.map((fact) => (
                <li key={fact}>
                  <LandingIcon name="check" size={16} strokeWidth={2.6} className={styles.factIcon} />
                  {fact}
                </li>
              ))}
            </ul>
            <Link href="/login" className={shared.primaryAction}>
              Go live with Studio
            </Link>
          </article>
        </div>
      </div>
    </section>
  );
}
