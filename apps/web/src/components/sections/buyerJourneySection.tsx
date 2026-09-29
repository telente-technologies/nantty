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
    description: "Scroll posts, clips and live streams from sellers and creators. Tap a tagged item to see the product.",
    screen: "homeMartScreen",
    screenAlt: "Zudomart Mart tab with categories and a grid of products",
  },
  {
    title: "Ask the seller",
    description: "Message the seller about sizes, colours or delivery before you pay. The chat stays attached to your order.",
    screen: "chatWithSellerScreen",
    screenAlt: "Zudomart chat screen with a seller",
  },
  {
    title: "Pay into escrow",
    description: "Check out from one or many stores in your local currency. Your payment is held by Zudomart, not sent to the seller yet.",
    screen: "shoppingCartScreen",
    screenAlt: "Zudomart cart with items, order summary and a checkout button",
  },
  {
    title: "Confirm and release",
    description: "When your order arrives as described, confirm delivery. Only then is the seller paid.",
    screen: "productDetailScreen",
    screenAlt: "Zudomart product page with shop details and reviews",
  },
];

export function BuyerJourneyStepsSection() {
  return (
    <section id="how-it-works" className={styles.section} aria-labelledby="how-it-works-heading">
      <div className="pageContainer">
        <SectionIntroWithEyebrowAndHeading
          eyebrow="How buying works"
          headingId="how-it-works-heading"
          heading="From scroll to doorstep in four steps."
          description="You see the seller, talk to the seller, and pay without the usual worry about what will actually show up."
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
