import { FigmaIconTintedWithCurrentColor, type FigmaIconName } from "../ui/figmaIcon";
import { SectionIntroWithEyebrowAndHeading } from "../ui/sectionIntro";
import { InteractiveEscrowReceiptDemo } from "./escrowReceiptDemo";
import styles from "./escrowTrustSection.module.css";

const escrowPromises: ReadonlyArray<{ readonly icon: FigmaIconName; readonly title: string; readonly description: string }> = [
  {
    icon: "shield24",
    title: "Payment stays with the payment partner",
    description: "For eligible Nigerian orders, funds remain in the buyer’s own payment-partner account while escrow is active. Nantty does not hold customer money.",
  },
  {
    icon: "warning20",
    title: "Something wrong? Raise it",
    description: "If an eligible order is missing, damaged or not as described, the buyer can raise a dispute before confirming. Release follows the order policy and dispute outcome.",
  },
  {
    icon: "truck24",
    title: "One checkout, many stores",
    description: "The planned marketplace checkout can group items from multiple stores while keeping each seller’s order and payment status separate.",
  },
];

export function EscrowTrustSection() {
  return (
    <section id="escrow" className={styles.section} aria-labelledby="escrow-heading">
      <div className={`pageContainer ${styles.layout}`}>
        <div className={styles.copyColumn}>
          <SectionIntroWithEyebrowAndHeading
            tone="dark"
            eyebrow="Payment protection, where available"
            headingId="escrow-heading"
            heading="What you ordered is what you pay for."
            description="Nantty is being built with payment-partner escrow for eligible Nigerian orders. Funds remain in the buyer’s own provider account—not with Nantty—and release follows delivery confirmation or dispute review. This demo illustrates the planned flow."
          />
          <ul className={styles.promiseList}>
            {escrowPromises.map((escrowPromise) => (
              <li key={escrowPromise.title} className={styles.promise}>
                <span className={styles.promiseIcon}>
                  <FigmaIconTintedWithCurrentColor name={escrowPromise.icon} size={22} />
                </span>
                <span>
                  <strong className={styles.promiseTitle}>{escrowPromise.title}</strong>
                  <span className={styles.promiseDescription}>{escrowPromise.description}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className={styles.demoColumn}>
          <InteractiveEscrowReceiptDemo />
        </div>
      </div>
    </section>
  );
}
