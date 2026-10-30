import { ActionLinkStyledAsButton } from "../ui/actionLink";
import { FigmaIconTintedWithCurrentColor } from "../ui/figmaIcon";
import { PhoneFrameWithAppScreen } from "../ui/phoneFrame";
import { SellerWalletPreviewCard } from "../ui/sellerWalletPreviewCard";
import styles from "./sellersTeaserSection.module.css";

const sellerBenefits = [
  "A planned store on your profile, alongside posts and clips",
  "Creator-approved live tools, with video LIVE remaining in beta",
  "A seller workspace designed for orders, customers and stock",
  "Payment and payout status designed to be clear",
] as const;

export function SellersTeaserSection() {
  return (
    <section className={`${styles.section} lightIsland`} aria-labelledby="sellers-teaser-heading">
      <div className={`pageContainer ${styles.layout}`}>
        <div className={styles.visual}>
          <PhoneFrameWithAppScreen screen="creatorProfileScreen" alt="TundeTech seller profile with a gold business badge, followers and a View Shop button" className={styles.phone} sizes="(min-width: 960px) 300px, 60vw" />
          <SellerWalletPreviewCard className={styles.walletCard} />
        </div>
        <div className={styles.copyColumn}>
          <p className={styles.eyebrow}>For sellers · in development</p>
          <h2 id="sellers-teaser-heading" className={styles.heading}>
            Turn discovery into a clearer way to shop.
          </h2>
          <p className={styles.description}>
            We’re building stores that connect products with the posts and conversations where people discover them. Seller onboarding and payment features are not open to the public yet.
          </p>
          <ul className={styles.benefitList}>
            {sellerBenefits.map((sellerBenefit) => (
              <li key={sellerBenefit}>
                <FigmaIconTintedWithCurrentColor name="check16" size={16} />
                {sellerBenefit}
              </li>
            ))}
          </ul>
          <div className={styles.actions}>
            <ActionLinkStyledAsButton href="/sellers">See how selling works</ActionLinkStyledAsButton>
            <ActionLinkStyledAsButton href="/waitlist" appearance="secondary">
              Join the waitlist
            </ActionLinkStyledAsButton>
          </div>
        </div>
      </div>
    </section>
  );
}
