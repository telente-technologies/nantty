import Link from "next/link";

import { ZudomartWordmark } from "@zudomart/web-kit";
import { FeedCardIllustration, MarketplaceGridIllustration } from "@/components/landing/landingAdIllustrations";

import styles from "./loginBrandPanel.module.css";

export function LoginBrandPanelWithAdComposition() {
  return (
    <section className={styles.panel} aria-labelledby="login-brand-heading">
      <Link href="/" className={styles.wordmarkLink} aria-label="Zudomart Ads home">
        <ZudomartWordmark productLabel="Ads" tone="onDark" withSymbol />
      </Link>
      <div className={styles.statement}>
        <h2 id="login-brand-heading" className={styles.heading}>
          One Zudomart account. Every buyer you want to reach.
        </h2>
        <p className={styles.lede}>Run Marketplace, Feed, Reels and Live ads for your store, pay in your local currency, and see which ads became orders.</p>
      </div>
      <div className={styles.composition} aria-label="Examples of Zudomart ads">
        <div className={styles.compositionMarketplace}>
          <MarketplaceGridIllustration />
        </div>
        <div className={styles.compositionFeed}>
          <FeedCardIllustration />
        </div>
      </div>
    </section>
  );
}
