import { ActionLinkStyledAsButton } from "@/components/ui/actionLink";
import { FigmaIconTintedWithCurrentColor, type FigmaIconName } from "@/components/ui/figmaIcon";
import { PageHeaderWithTitleAndLede } from "@/components/ui/pageHeader";
import { PhoneFrameWithAppScreen } from "@/components/ui/phoneFrame";
import { createPublicPageMetadata } from "@/lib/pageMetadata.util";

import styles from "./about.module.css";

export const metadata = createPublicPageMetadata({ title: "About", description: "Why we are building Nantty: Social Commerce in Nigeria with real sellers and escrow-protected payments.", path: "/about" });

const companyPrinciples: ReadonlyArray<{ readonly icon: FigmaIconName; readonly title: string; readonly description: string }> = [
  { icon: "sealCheck20", title: "Real sellers only", description: "Every store is reviewed before it opens, and verified sellers carry a badge buyers can check." },
  { icon: "shield24", title: "Money moves last", description: "Buyers pay into escrow. Sellers are paid when delivery is confirmed, not before." },
  { icon: "chatCircle24", title: "Shopping is social", description: "People buy from people they follow. We build around posts, clips, lives and chats, not just catalogues." },
  { icon: "mapPin24", title: "Local first", description: "Built in Nigeria, launching Nigeria first, with prices in your local currency and payment methods you already use." },
];

export default function AboutPage() {
  return (
    <>
      <PageHeaderWithTitleAndLede
        eyebrow="About Nantty"
        title="Buying from a seller you follow shouldn't feel like a gamble."
        lede="In Nigeria, a lot of shopping already happens on social media: a post, a DM, a transfer to an account number, then a wait. Nantty keeps the part people love and fixes the part that goes wrong."
      />
      <section className={`pageContainer ${styles.story}`} aria-labelledby="story-heading">
        <div className={styles.storyText}>
          <h2 id="story-heading" className={styles.storyHeading}>
            Why we started
          </h2>
          <p>
            Small sellers build real audiences with photos, videos and live streams. Buyers love discovering them. But the checkout is usually a chat thread and a bank transfer, and when an order goes missing or arrives wrong, there is little a buyer can do.
          </p>
          <p>
            Nantty puts those sellers, their content and a proper multi-vendor checkout in one app. Payments sit in escrow until the buyer confirms delivery, so trust no longer depends on how many followers a store has.
          </p>
        </div>
        <PhoneFrameWithAppScreen screen="homeFeedScreen" alt="Nantty home feed with a post from a Lagos fashion seller" className={styles.phone} sizes="(min-width: 960px) 280px, 60vw" />
      </section>
      <section className={styles.principles} aria-labelledby="principles-heading">
        <div className="pageContainer">
          <h2 id="principles-heading" className={styles.principlesHeading}>
            What we hold ourselves to
          </h2>
          <ul className={styles.principleList}>
            {companyPrinciples.map((companyPrinciple) => (
              <li key={companyPrinciple.title} className={styles.principle}>
                <FigmaIconTintedWithCurrentColor name={companyPrinciple.icon} size={24} className={styles.principleIcon} />
                <h3 className={styles.principleTitle}>{companyPrinciple.title}</h3>
                <p className={styles.principleDescription}>{companyPrinciple.description}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section className={`pageContainer ${styles.split}`} aria-label="Get involved">
        <div className={`${styles.splitCard} ${styles.splitCardBuyer}`}>
          <h2 className={styles.splitHeading}>Shopping?</h2>
          <p>Get the app on iPhone or Android, or shop from the web app in your browser.</p>
          <ActionLinkStyledAsButton href="/#download" appearance="onDark">
            Get the app
          </ActionLinkStyledAsButton>
        </div>
        <div className={`${styles.splitCard} ${styles.splitCardSeller} lightIsland`}>
          <h2 className={styles.splitHeading}>Selling?</h2>
          <p>See how stores, live selling, escrow and payouts work for sellers.</p>
          <ActionLinkStyledAsButton href="/sellers">Sell on Nantty</ActionLinkStyledAsButton>
        </div>
      </section>
    </>
  );
}
