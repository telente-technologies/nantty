import { ActionLinkStyledAsButton } from "@/components/ui/actionLink";
import { FigmaIconTintedWithCurrentColor, type FigmaIconName } from "@/components/ui/figmaIcon";
import { PageHeaderWithTitleAndLede } from "@/components/ui/pageHeader";
import { PhoneFrameWithAppScreen } from "@/components/ui/phoneFrame";
import { createPublicPageMetadata } from "@/lib/pageMetadata.util";
import { isPrelaunchMode } from "@/lib/siteConfig.config";

import styles from "./about.module.css";

export const metadata = createPublicPageMetadata({ title: "About", description: isPrelaunchMode ? "Why we are building Nantty: a social marketplace for discovering Nigerian sellers and creators. Join the waitlist for launch updates." : "Why we built Nantty: social shopping with sellers, creators and payment-partner protection for eligible orders.", path: "/about" });

const companyPrinciples: ReadonlyArray<{ readonly icon: FigmaIconName; readonly title: string; readonly description: string }> = [
  { icon: "sealCheck20", title: "Real sellers only", description: isPrelaunchMode ? "We plan to review stores before they open and make seller verification visible to buyers." : "Stores are reviewed before opening, and verified sellers carry a badge buyers can check." },
  { icon: "shield24", title: "Money moves last", description: isPrelaunchMode ? "For eligible Nigerian orders, the planned payment-partner flow keeps funds outside Nantty until delivery confirmation or dispute review." : "For eligible orders, the payment partner releases funds under the order policy after delivery confirmation or dispute review." },
  { icon: "chatCircle24", title: "Shopping is social", description: isPrelaunchMode ? "We’re designing discovery around seller and creator posts, clips, live formats and conversations—not just catalogues." : "People discover sellers through posts, clips, live formats and conversations—not just catalogues." },
  { icon: "mapPin24", title: "Local first", description: "Built in Nigeria, launching Nigeria first, with prices in your local currency and payment methods you already use." },
];

export default function AboutPage() {
  return (
    <>
      <PageHeaderWithTitleAndLede
        eyebrow="About Nantty"
        title={isPrelaunchMode ? "Buying from a seller you follow shouldn't feel like a gamble." : "A more confident way to shop socially."}
        lede={isPrelaunchMode ? "In Nigeria, a lot of shopping already happens on social media: a post, a message, then a payment and a wait. We’re building Nantty to bring discovery and shopping together with clearer protections." : "Nantty brings seller and creator discovery together with product details, conversations and payment options designed to make online shopping clearer."}
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
            {isPrelaunchMode
              ? "Nantty is being built to bring sellers, their content and a multi-vendor checkout into one product. For eligible Nigerian orders, the planned escrow flow uses our licensed payment partner; Nantty does not hold customer money. The product is still in development, and final feature availability will be confirmed before launch."
              : "Nantty brings sellers, their content and marketplace checkout into one product. For eligible Nigerian orders, escrow uses our licensed payment partner; Nantty does not hold customer money. Payment availability depends on market and payment method."}
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
          <p>{isPrelaunchMode ? "Nantty is not open to the public yet. Join the waitlist for launch updates." : "Discover sellers, creators and products on Nantty."}</p>
          <ActionLinkStyledAsButton href={isPrelaunchMode ? "/waitlist" : "https://web.nantty.com"} appearance="onDark" opensInNewTab={!isPrelaunchMode} disabled={!isPrelaunchMode && process.env.NANTTY_CLOUDFLARE_STATIC_EXPORT === "1"}>
            {isPrelaunchMode ? "Join the waitlist" : "Open the web app"}
          </ActionLinkStyledAsButton>
        </div>
        <div className={`${styles.splitCard} ${styles.splitCardSeller} lightIsland`}>
          <h2 className={styles.splitHeading}>Selling?</h2>
          <p>{isPrelaunchMode ? "Seller stores, order tools and payment-partner protection are in development. Join the waitlist for launch updates; seller access is not open yet." : "See how stores, live selling, escrow and payouts work for sellers."}</p>
          <ActionLinkStyledAsButton href={isPrelaunchMode ? "/waitlist" : "/sellers"}>{isPrelaunchMode ? "Join the waitlist" : "Sell on Nantty"}</ActionLinkStyledAsButton>
        </div>
      </section>
    </>
  );
}
