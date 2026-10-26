import { businessAppLinks } from "@/lib/siteConfig.config";

import { ActionLinkStyledAsButton } from "../ui/actionLink";
import { PhoneFrameWithAppScreen } from "../ui/phoneFrame";
import styles from "./sellersHeroSection.module.css";

export function SellersPageHeroSection() {
  return (
    <section className={`${styles.hero} lightIsland`} aria-labelledby="sellers-hero-heading">
      <div className={`pageContainer ${styles.layout}`}>
        <div className={styles.copyColumn}>
          <p className={styles.eyebrow}>Sell on Nantty</p>
          <h1 id="sellers-hero-heading" className={styles.heading}>
            Turn your followers into paying customers.
          </h1>
          <p className={styles.lede}>
            Post, go live and tag your products. Buyers check out inside the app, pay into escrow, and you get paid to your wallet once they confirm delivery.
          </p>
          <div className={styles.actions}>
            <ActionLinkStyledAsButton href="#apply">Apply to sell</ActionLinkStyledAsButton>
            <ActionLinkStyledAsButton href="#how-selling-works" appearance="secondary">
              How selling works
            </ActionLinkStyledAsButton>
          </div>
          <p className={styles.dashboardNote}>
            Already selling?{" "}
            <a href={businessAppLinks.sellerDashboard.href} target="_blank" rel="noopener noreferrer">
              Open {businessAppLinks.sellerDashboard.label}
              <span className="visuallyHidden"> (opens in a new tab)</span>
            </a>{" "}
            and sign in with your Nantty app account. It&apos;s free for every seller.
          </p>
        </div>
        <div className={styles.visual}>
          <PhoneFrameWithAppScreen screen="liveShoppingScreen" alt="A seller's live session promoted in Clips with a Watch live button" className={`${styles.phone} ${styles.phoneBack}`} sizes="(min-width: 960px) 240px, 40vw" />
          <PhoneFrameWithAppScreen screen="creatorProfileScreen" alt="TundeTech seller profile with a gold business badge and a View Shop button" className={`${styles.phone} ${styles.phoneFront}`} priority sizes="(min-width: 960px) 280px, 50vw" />
        </div>
      </div>
    </section>
  );
}
