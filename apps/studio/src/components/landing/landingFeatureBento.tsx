import type { ReactNode } from "react";

import { AnalyticsVisual, BattleVisual, CheckmarkVisual, GiftsVisual, LeaderboardVisual, ModerationVisual, OverlayVisual, RecordingsVisual } from "./featureBentoVisuals";
import shared from "./landingPage.module.css";
import styles from "./landingFeatureBento.module.css";
import { PrelaunchLoginAction } from "./prelaunchLoginAction";

interface BentoFeature {
  readonly title: string;
  readonly description: string;
  readonly visual: ReactNode;
  readonly size: "wide" | "regular";
}

const bentoFeatures: readonly BentoFeature[] = [
  { title: "Gifts with combos and goals", description: "Every gift lands on screen with a combo count. Set a gift goal for your next mic, show or trip and watch the bar fill.", visual: <GiftsVisual />, size: "wide" },
  { title: "Battles that pull a crowd", description: "Timed battles with live scores. Turn on winner takes all when you want the stakes high.", visual: <BattleVisual />, size: "regular" },
  { title: "Overlays and scenes", description: "Lower thirds, logos, countdowns and tickers on a 1920 × 1080 canvas, added to OBS as one browser source.", visual: <OverlayVisual />, size: "regular" },
  { title: "Comments you control", description: "Hold messages with blocked words, turn on slow mode and add moderators you trust.", visual: <ModerationVisual />, size: "regular" },
  { title: "Nantty Points leaderboards", description: "Fans climb your leaderboard with gifts and engagement. Points rank fans; they are never cash.", visual: <LeaderboardVisual />, size: "regular" },
  { title: "Replays of every live", description: "Each live is recorded so fans who missed it can catch up and you can cut highlights.", visual: <RecordingsVisual />, size: "regular" },
  { title: "Analytics after every show", description: "Peak viewers, watch time, new followers and top gifters for each live.", visual: <AnalyticsVisual />, size: "regular" },
  { title: "Blue checkmark for creators", description: "Show viewers it is really you. Apply for the Blue checkmark from the Nantty app.", visual: <CheckmarkVisual />, size: "regular" },
];

export function LandingFeatureBento() {
  return (
    <section id="features" className={`${shared.section} ${styles.section}`} aria-labelledby="features-heading">
      <div className={shared.inner}>
        <div className={styles.head}>
          <div className={shared.intro}>
            <p className={shared.eyebrow}>Live features</p>
            <h2 id="features-heading" className={shared.heading}>
              Everything your live needs, built in.
            </h2>
            <p className={shared.lede}>No plugins to stitch together. Gifts, battles, overlays, moderation and replays work the moment you go live.</p>
          </div>
          <PrelaunchLoginAction className={shared.secondaryAction}>
            See it in your control room
          </PrelaunchLoginAction>
        </div>
        <ul className={styles.grid}>
          {bentoFeatures.map((feature) => (
            <li key={feature.title} className={`${styles.card} ${feature.size === "wide" ? styles.wide : ""}`}>
              <div className={styles.cardText}>
                <h3 className={styles.cardTitle}>{feature.title}</h3>
                <p className={styles.cardDescription}>{feature.description}</p>
              </div>
              <div className={styles.visualWindow}>{feature.visual}</div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
