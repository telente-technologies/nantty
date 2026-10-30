import { OfficialStoreBadges } from "@nantty/web-kit";

import { isPrelaunchMode, storeLinks, webAppLink } from "@/lib/siteConfig.config";

import { ActionLinkStyledAsButton } from "../ui/actionLink";
import { FigmaIconTintedWithCurrentColor } from "../ui/figmaIcon";
import { LocalCurrencySymbol } from "../ui/localCurrencySymbol";
import { PhoneFrameWithAppScreen } from "../ui/phoneFrame";
import styles from "./heroSection.module.css";

export function HomeHeroSectionWithPhoneStage() {
  const visibleStoreLinks = isPrelaunchMode ? { appStoreUrl: null, playStoreUrl: null } : storeLinks;
  return (
    <section className={styles.hero} aria-labelledby="hero-heading">
      <div className={`pageContainer ${styles.layout}`}>
        <div className={styles.copyColumn}>
          <p className="eyebrowLabel">{isPrelaunchMode ? "Social commerce, being built for Nigeria" : "Social commerce, made for Nigeria"}</p>
          <h1 id="hero-heading" className={styles.heading}>
            {isPrelaunchMode ? "Discover the sellers you already " : "Shop the sellers you already "}<span className={styles.priceTag}>watch.</span>
          </h1>
          <p className={styles.lede}>
            {isPrelaunchMode
              ? "We’re building one place to discover independent sellers and creators, explore what they share, and shop with clearer protections. Nantty is still in development; join the waitlist for launch updates."
              : "Discover independent sellers and creators, explore what they share, and shop with clearer protections."}
          </p>
          <div className={styles.actions}>
            {isPrelaunchMode
              ? <ActionLinkStyledAsButton href="/waitlist">Join the waitlist</ActionLinkStyledAsButton>
              : <ActionLinkStyledAsButton href={webAppLink.href} opensInNewTab>{webAppLink.label}</ActionLinkStyledAsButton>}
            <OfficialStoreBadges links={visibleStoreLinks} />
          </div>
          <ul className={styles.proofList}>
            <li>
              <FigmaIconTintedWithCurrentColor name="shield24" size={18} />
              {isPrelaunchMode ? "Buyer protection is being built" : "Payment-partner protection on eligible orders"}
            </li>
            <li>
              <FigmaIconTintedWithCurrentColor name="sealCheck20" size={18} />
              {isPrelaunchMode ? "Seller verification is part of the plan" : "Seller verification supports trust"}
            </li>
            <li>
              <FigmaIconTintedWithCurrentColor name="apple24" size={18} />
              {isPrelaunchMode ? "Planned for iPhone and Android" : "Available on iPhone and Android"}
            </li>
          </ul>
        </div>
        <div className={styles.stage}>
          <div className={styles.stagePanel} aria-hidden="true" />
          <PhoneFrameWithAppScreen screen="creatorProfileScreen" alt="TundeTech seller profile with a gold business badge, followers and a View Shop button" className={`${styles.phone} ${styles.phoneLeft}`} sizes="(min-width: 900px) 220px, 34vw" />
          <PhoneFrameWithAppScreen screen="homeFeedScreen" alt="Nantty home feed showing a new Ankara collection post from Adaeze Okafor" className={`${styles.phone} ${styles.phoneCenter}`} priority sizes="(min-width: 900px) 280px, 46vw" />
          <PhoneFrameWithAppScreen screen="productDetailScreen" alt="Ankara wrap midi dress product page with its naira price, official store badge and Add to Cart" className={`${styles.phone} ${styles.phoneRight}`} sizes="(min-width: 900px) 220px, 34vw" />
          <p className={`${styles.floatingChip} ${styles.liveChip}`}>
            <span className={styles.liveDot} aria-hidden="true" />
            {isPrelaunchMode ? "A preview of what we’re building" : "Live shopping"}
          </p>
          <p className={`${styles.floatingChip} ${styles.escrowChip}`}>
            <span className={styles.currencyCoin}>
              <LocalCurrencySymbol />
            </span>
            <span>{isPrelaunchMode ? "Eligible orders are designed for payment-partner escrow" : "Payment-partner escrow for eligible Nigerian orders"}</span>
          </p>
        </div>
      </div>
    </section>
  );
}
