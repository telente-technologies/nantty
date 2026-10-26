import { ActionLinkStyledAsButton } from "../ui/actionLink";
import { FigmaIconTintedWithCurrentColor } from "../ui/figmaIcon";
import { PhoneFrameWithAppScreen } from "../ui/phoneFrame";
import { SellerWalletPreviewCard } from "../ui/sellerWalletPreviewCard";
import styles from "./sellersTeaserSection.module.css";

const sellerBenefits = [
  "A store on your profile, next to your posts and clips",
  "Go live and sell while you talk",
  "Orders, chats and stock in one seller dashboard",
  "A wallet that pays out to your bank account",
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
          <p className={styles.eyebrow}>For sellers</p>
          <h2 id="sellers-teaser-heading" className={styles.heading}>
            Your followers keep asking “how much?” Give them a checkout.
          </h2>
          <p className={styles.description}>
            Stop sending account numbers in DMs. Open a Nantty store, tag products in your content, and get paid once buyers confirm delivery.
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
            <ActionLinkStyledAsButton href="/sellers#apply" appearance="secondary">
              Apply to sell
            </ActionLinkStyledAsButton>
          </div>
        </div>
      </div>
    </section>
  );
}
