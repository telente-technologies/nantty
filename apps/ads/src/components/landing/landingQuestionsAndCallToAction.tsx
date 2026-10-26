import { OfficialStoreBadges } from "@nantty/web-kit";

import { ZudoIcon } from "@/components/ui/zudoIcon";
import { buildContactMailtoLink, contactEmailDisplayText, readNanttyMainSiteUrl, storeLinks } from "@/constants/contact.constant";

import { MarketplaceGridIllustration } from "./landingAdIllustrations";
import { landingQuestions } from "./landingCopy.content";
import { LandingActionLink, SectionIntro, type LandingAction } from "./landingPrimitives";
import styles from "./landingFeatures.module.css";

export function LandingQuestionsSection() {
  return (
    <section id="questions" className={`${styles.featureSection} ${styles.featureSectionTinted}`} aria-labelledby="questions-heading">
      <div className={`${styles.container} ${styles.questionsLayout}`}>
        <div>
          <SectionIntro eyebrow="FAQ" headingId="questions-heading" heading="Questions, answered." />
          <p className={styles.contactNote}>
            Something else? Email <a href={buildContactMailtoLink("Nantty Ads question")}>{contactEmailDisplayText}</a>.
          </p>
        </div>
        <div className={styles.questionList}>
          {landingQuestions.map((item) => (
            <details key={item.question} className={styles.questionItem}>
              <summary className={styles.question}>
                {item.question}
                <ZudoIcon name="plus16" size={16} className={styles.questionToggle} />
              </summary>
              <p className={styles.answer}>{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingFinalCallToAction({ primaryAction, isSignedIn }: { readonly primaryAction: LandingAction; readonly isSignedIn: boolean }) {
  return (
    <section className={styles.callToActionSection} aria-labelledby="final-cta-heading">
      <div className={styles.container}>
        <div className={styles.callToActionPanel}>
          <div className={styles.callToActionCopy}>
            <h2 id="final-cta-heading" className={styles.callToActionHeading}>
              Your next buyer is scrolling Nantty right now.
            </h2>
            <p className={styles.callToActionLede}>Sign in with your Nantty account and launch your first campaign in minutes. Your store, posts and clips are already there.</p>
            <div className={styles.callToActionActions}>
              <LandingActionLink action={primaryAction} tone="accent" />
              {isSignedIn ? null : (
                <a href={readNanttyMainSiteUrl()} className={styles.callToActionSecondary}>
                  New to Nantty? Get the app
                </a>
              )}
            </div>
            {isSignedIn ? null : <OfficialStoreBadges links={storeLinks} className={styles.callToActionStoreBadges} />}
          </div>
          <div className={styles.callToActionArt}>
            <MarketplaceGridIllustration />
          </div>
        </div>
      </div>
    </section>
  );
}
