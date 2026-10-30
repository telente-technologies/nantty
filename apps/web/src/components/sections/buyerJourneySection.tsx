import type { AppScreenName } from "../ui/phoneFrame";
import { PhoneFrameWithAppScreen } from "../ui/phoneFrame";
import { SectionIntroWithEyebrowAndHeading } from "../ui/sectionIntro";
import styles from "./buyerJourneySection.module.css";

interface BuyerJourneyStep {
  readonly title: string;
  readonly description: string;
  readonly screen: AppScreenName;
  readonly screenAlt: string;
}

const buyerJourneySteps: readonly BuyerJourneyStep[] = [
  {
    title: "Discover",
    description: "The planned feed brings together posts, clips and seller content. When the feature is available, a tagged item can take you to its product page.",
    screen: "martProductsScreen",
    screenAlt: "Nantty Mart tab with Ankara dresses, earbuds and skincare priced in naira",
  },
  {
    title: "Ask the seller",
    description: "Ask a seller about sizes, colours or delivery before checkout, using the product and order conversation tools as they become available.",
    screen: "chatWithSellerScreen",
    screenAlt: "Chat with Adaeze Styles asking if an Adire kaftan is available in size L",
  },
  {
    title: "Pay into escrow",
    description: "For eligible Nigerian orders, the planned checkout uses payment-partner escrow. Nantty does not hold customer funds; availability depends on the payment method and supported market.",
    screen: "shoppingCartScreen",
    screenAlt: "Nantty cart with earbuds, a vitamin C serum and suya spice, with the order summary",
  },
  {
    title: "Confirm and release",
    description: "For an eligible escrow order, the buyer can confirm delivery or raise a dispute before funds are released under the applicable order policy.",
    screen: "escrowStatusScreen",
    screenAlt: "Payment protection timeline for a delivered order, with the payment still held in escrow until the buyer confirms",
  },
];

export function BuyerJourneyStepsSection() {
  return (
    <section id="how-it-works" className={styles.section} aria-labelledby="how-it-works-heading">
      <div className="pageContainer">
        <SectionIntroWithEyebrowAndHeading
          eyebrow="The planned buyer journey"
          headingId="how-it-works-heading"
          heading="A more confident way to shop socially."
          description="Nantty is still being built. These screens show the intended buyer journey; features and availability may change before launch."
        />
        <ol className={styles.stepList}>
          {buyerJourneySteps.map((journeyStep, stepIndex) => (
            <li key={journeyStep.title} className={styles.stepCard}>
              <div className={styles.stepText}>
                <p className={styles.stepNumber} aria-hidden="true">
                  {stepIndex + 1}
                </p>
                <h3 className={styles.stepTitle}>{journeyStep.title}</h3>
                <p className={styles.stepDescription}>{journeyStep.description}</p>
              </div>
              <div className={styles.screenWindow}>
                <PhoneFrameWithAppScreen screen={journeyStep.screen} alt={journeyStep.screenAlt} className={styles.phone} sizes="(min-width: 1000px) 220px, (min-width: 640px) 40vw, 70vw" />
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
