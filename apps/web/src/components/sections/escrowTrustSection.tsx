import { FigmaIconTintedWithCurrentColor, type FigmaIconName } from "../ui/figmaIcon";
import { SectionIntroWithEyebrowAndHeading } from "../ui/sectionIntro";
import { InteractiveEscrowReceiptDemo } from "./escrowReceiptDemo";
import styles from "./escrowTrustSection.module.css";

const escrowPromises: ReadonlyArray<{ readonly icon: FigmaIconName; readonly title: string; readonly description: string }> = [
  {
    icon: "shield24",
    title: "The seller waits, not you",
    description: "Your money sits in escrow from checkout until you confirm delivery. No transfer to a stranger's account.",
  },
  {
    icon: "warning20",
    title: "Something wrong? Raise it",
    description: "If the item is missing, damaged or not as described, open a dispute before confirming. The money stays held while it is reviewed.",
  },
  {
    icon: "truck24",
    title: "One checkout, many stores",
    description: "Buy from several sellers in one cart. Each seller is paid separately, only for what you received from them.",
  },
];

export function EscrowTrustSection() {
  return (
    <section id="escrow" className={styles.section} aria-labelledby="escrow-heading">
      <div className={`pageContainer ${styles.layout}`}>
        <div className={styles.copyColumn}>
          <SectionIntroWithEyebrowAndHeading
            tone="dark"
            eyebrow="Escrow on every order"
            headingId="escrow-heading"
            heading="What you ordered is what you pay for."
            description="Nantty holds your payment until your order is in your hands. Try it: watch the example order move, then confirm delivery."
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
