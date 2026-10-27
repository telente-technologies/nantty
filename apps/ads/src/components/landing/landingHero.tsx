import { NanttyIcon } from "@/components/ui/nanttyIcon";

import { FeedCardIllustration } from "./landingAdIllustrations";
import { LandingActionLink, ScreenshotInBrowserFrame, type LandingAction } from "./landingPrimitives";
import { heroFeedPost } from "./landingShowcase.content";
import styles from "./landingSections.module.css";

export function LandingHeroWithProductStage({ primaryAction, isSignedIn }: { readonly primaryAction: LandingAction; readonly isSignedIn: boolean }) {
  return (
    <section className={styles.hero} aria-labelledby="hero-heading">
      <div className={`${styles.container} ${styles.heroLayout}`}>
        <div className={styles.heroCopy}>
          <p className={styles.heroEyebrow}>Nantty Ads Manager</p>
          <h1 id="hero-heading" className={styles.heroHeading}>
            Put your store where Nigeria <span className={styles.priceTag}>shops.</span>
          </h1>
          <p className={styles.heroLede}>
            Promote your products, posts, clips and live streams to buyers across Nantty. Target by city, interest and your own customers, pay in your local currency, and see which ads turned into orders.
          </p>
          <div className={styles.heroActions}>
            <LandingActionLink action={primaryAction} />
            <LandingActionLink action={{ href: "#formats", label: "See where ads appear" }} tone="quiet" />
          </div>
          {isSignedIn ? null : <p className={styles.heroNote}>Use the same account as the Nantty app. There is nothing new to sign up for.</p>}
          <ul className={styles.proofList}>
            <li>
              <NanttyIcon name="shield24" size={18} />
              Every ad reviewed before it runs
            </li>
            <li>
              <NanttyIcon name="shoppingCart24" size={18} />
              Store sales attributed automatically
            </li>
            <li>
              <NanttyIcon name="creditCard24" size={18} />
              Billing in your local currency
            </li>
          </ul>
        </div>
        <div className={styles.heroStage}>
          <div className={styles.heroStagePanel} aria-hidden />
          <div className={styles.heroScreenshot}>
            <ScreenshotInBrowserFrame src="/screenshots/overview.webp" alt="Ads Manager overview with spend, results, reach and a daily spend chart for a Lagos fashion store" address="ads.nantty.com/overview" priority />
          </div>
          <div className={styles.heroPhone}>
            <FeedCardIllustration post={heroFeedPost} />
          </div>
          <p className={styles.heroChip}>
            <span className={styles.heroChipDot} aria-hidden />
            New order attributed to your ad
          </p>
        </div>
      </div>
    </section>
  );
}
