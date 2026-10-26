import { campaignCreationSteps } from "./landingCopy.content";
import { ScreenshotInBrowserFrame, SectionIntro } from "./landingPrimitives";
import styles from "./campaignStepsSection.module.css";

export function CampaignStepsSection() {
  return (
    <section id="how-it-works" className={styles.stepsSection} aria-labelledby="steps-heading">
      <div className={`${styles.container} ${styles.stepsLayout}`}>
        <div>
          <SectionIntro eyebrow="How it works" headingId="steps-heading" heading="From idea to live ad, one step at a time." lede="Ads Manager guides you through every campaign with a live audience estimate beside you. You can save a draft at any point." />
          <ol className={styles.stepList}>
            {campaignCreationSteps.map((step, stepIndex) => (
              <li key={step.title} className={styles.stepItem}>
                <span className={styles.stepNumber} aria-hidden>
                  {stepIndex + 1}
                </span>
                <div>
                  <h3 className={styles.stepTitle}>{step.title}</h3>
                  <p className={styles.stepDescription}>{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className={styles.stepsScreenshot}>
          <ScreenshotInBrowserFrame src="/screenshots/wizardObjective.webp" alt="Create campaign screen with the six-step progress list and objective choices such as sales, messages and store promotion" address="ads.nantty.com/campaigns/new" />
        </div>
      </div>
    </section>
  );
}
