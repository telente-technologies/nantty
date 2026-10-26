import { FigmaIconTintedWithCurrentColor, type FigmaIconName } from "../ui/figmaIcon";
import { SectionIntroWithEyebrowAndHeading } from "../ui/sectionIntro";
import { PhoneFrameWithAppScreen } from "../ui/phoneFrame";
import styles from "./sellerPayoutsSection.module.css";

const payoutFlowStages: ReadonlyArray<{ readonly icon: FigmaIconName; readonly title: string; readonly description: string }> = [
  { icon: "shield24", title: "Escrow", description: "The buyer's payment is held safely while the order is on its way." },
  { icon: "check16", title: "Delivery confirmed", description: "The buyer confirms the order arrived as described." },
  { icon: "speedometer24", title: "Your wallet", description: "The sale lands in your Nantty wallet, minus any fees." },
  { icon: "buildingStore20", title: "Your bank", description: "Withdraw to your verified bank account in your local currency." },
];

export function SellerPayoutsSection() {
  return (
    <section id="payouts" className={styles.section} aria-labelledby="payouts-heading">
      <div className={`pageContainer ${styles.layout}`}>
        <div className={styles.copyColumn}>
          <SectionIntroWithEyebrowAndHeading
            tone="dark"
            eyebrow="Wallet and payouts"
            headingId="payouts-heading"
            heading="Buyers trust escrow. You get paid on delivery."
            description="Escrow is why new buyers take a chance on a store they just found. Once they confirm, your money is yours to withdraw."
          />
          <ol className={styles.flowList}>
            {payoutFlowStages.map((payoutStage) => (
              <li key={payoutStage.title} className={styles.flowStage}>
                <span className={styles.flowIcon}>
                  <FigmaIconTintedWithCurrentColor name={payoutStage.icon} size={20} />
                </span>
                <span>
                  <strong className={styles.flowTitle}>{payoutStage.title}</strong>
                  <span className={styles.flowDescription}>{payoutStage.description}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
        <div className={styles.walletColumn}>
          <PhoneFrameWithAppScreen screen="sellerWalletScreen" alt="Seller wallet with the balance available to withdraw, money pending in escrow and each order's release date" className={styles.walletPhone} sizes="(min-width: 960px) 300px, 66vw" />
        </div>
      </div>
    </section>
  );
}
