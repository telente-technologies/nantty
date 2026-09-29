import type { ReactNode } from "react";

import { FeedCardIllustration, LiveCardIllustration, MarketplaceGridIllustration, ReelsIllustration } from "./landingAdIllustrations";
import { SectionIntro } from "./landingPrimitives";
import styles from "./landingSections.module.css";

interface AdFormatDescription {
  readonly name: string;
  readonly where: string;
  readonly detail: string;
  readonly illustration: ReactNode;
}

const adFormats: readonly AdFormatDescription[] = [
  { name: "Marketplace", where: "Mart grids, search results and categories", detail: "Sponsored product tiles look like every other product, marked “Ad”, and sit at fixed slots in the grid so browsing stays predictable.", illustration: <MarketplaceGridIllustration /> },
  { name: "Feed", where: "Home feed, between posts", detail: "Sponsored post cards with your photos and a button. Only long or landscape videos play as video in the feed; short vertical clips run in Reels.", illustration: <FeedCardIllustration /> },
  { name: "Reels", where: "The full-screen reels pager", detail: "Promoted clips play full screen between reels. Landscape videos can run too, with a “View full screen” option.", illustration: <ReelsIllustration /> },
  { name: "Live", where: "Live discovery, feed and reels", detail: "Promote a live shopping stream so more buyers join while you sell. It shows in live discovery and as a live card in feed and reels.", illustration: <LiveCardIllustration /> },
];

export function AdFormatsSection() {
  return (
    <section id="formats" className={styles.formatsSection} aria-labelledby="formats-heading">
      <div className={styles.container}>
        <SectionIntro eyebrow="Where ads appear" headingId="formats-heading" heading="Your ad takes the shape of the slot it runs in." lede="Four formats, each built from content buyers already scroll past every day. You choose the formats; we check your media fits each one before it goes to review." />
        <ul className={styles.formatGrid}>
          {adFormats.map((format) => (
            <li key={format.name} className={styles.formatCard}>
              <div className={styles.formatStage}>{format.illustration}</div>
              <div className={styles.formatText}>
                <h3 className={styles.formatName}>{format.name}</h3>
                <p className={styles.formatWhere}>{format.where}</p>
                <p className={styles.formatDetail}>{format.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
