import { FigmaIconTintedWithCurrentColor, type FigmaIconName } from "../ui/figmaIcon";
import { SectionIntroWithEyebrowAndHeading } from "../ui/sectionIntro";
import styles from "./sellerStepsSection.module.css";

const sellerOnboardingSteps: ReadonlyArray<{ readonly icon: FigmaIconName; readonly title: string; readonly description: string }> = [
  { icon: "textIndent24", title: "Apply", description: "Tell us about your business, what you sell and where you ship from. It takes a few minutes in the app." },
  { icon: "sealCheck20", title: "Get reviewed", description: "We check your details so buyers know your store is real. Approved stores get a verified badge." },
  { icon: "tag24", title: "List products", description: "Add photos, prices in your local currency, sizes, colours and stock. Your store shows on your profile." },
  { icon: "videoCamera24", title: "Sell through content", description: "Tag products in posts, clips, stories and live streams so viewers can buy without leaving." },
  { icon: "creditCard24", title: "Get paid", description: "When a buyer confirms delivery, the money moves from escrow to your wallet, ready to withdraw." },
];

export function SellerOnboardingStepsSection() {
  return (
    <section id="how-selling-works" className={styles.section} aria-labelledby="how-selling-works-heading">
      <div className="pageContainer">
        <SectionIntroWithEyebrowAndHeading
          eyebrow="How selling works"
          headingId="how-selling-works-heading"
          heading="From application to first payout."
          description="Every store is reviewed before it opens. After that, selling is as simple as posting."
        />
        <ol className={styles.stepList}>
          {sellerOnboardingSteps.map((onboardingStep, stepIndex) => (
            <li key={onboardingStep.title} className={styles.step}>
              <span className={styles.stepIcon}>
                <FigmaIconTintedWithCurrentColor name={onboardingStep.icon} size={22} />
              </span>
              <p className={styles.stepNumber}>Step {stepIndex + 1}</p>
              <h3 className={styles.stepTitle}>{onboardingStep.title}</h3>
              <p className={styles.stepDescription}>{onboardingStep.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
