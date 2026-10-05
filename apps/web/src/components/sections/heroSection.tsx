import { OfficialStoreBadges } from "@zudomart/web-kit";

import { storeLinks, webAppLink } from "@/lib/siteConfig.config";

import { ActionLinkStyledAsButton } from "../ui/actionLink";
import { FigmaIconTintedWithCurrentColor } from "../ui/figmaIcon";
import { LocalCurrencySymbol } from "../ui/localCurrencySymbol";
import { PhoneFrameWithAppScreen } from "../ui/phoneFrame";
import styles from "./heroSection.module.css";

export function HomeHeroSectionWithPhoneStage() {
  return (
    <section className={styles.hero} aria-labelledby="hero-heading">
      <div className={`pageContainer ${styles.layout}`}>
        <div className={styles.copyColumn}>
          <p className="eyebrowLabel">Social Commerce, made for Nigeria</p>
          <h1 id="hero-heading" className={styles.heading}>
            Shop the sellers you already <span className={styles.priceTag}>watch.</span>
          </h1>
          <p className={styles.lede}>
            Find real sellers through posts, clips, stories and live streams. Pay in your local currency, and your money stays in escrow until you confirm your order arrived.
          </p>
          <div className={styles.actions}>
            <ActionLinkStyledAsButton href={webAppLink.href} opensInNewTab>
              {webAppLink.label}
            </ActionLinkStyledAsButton>
            <OfficialStoreBadges links={storeLinks} />
          </div>
          <ul className={styles.proofList}>
            <li>
              <FigmaIconTintedWithCurrentColor name="shield24" size={18} />
              Escrow on every order
            </li>
            <li>
              <FigmaIconTintedWithCurrentColor name="sealCheck20" size={18} />
              Sellers are reviewed before they open
            </li>
            <li>
              <FigmaIconTintedWithCurrentColor name="apple24" size={18} />
              iPhone and Android
            </li>
          </ul>
        </div>
        <div className={styles.stage}>
          <div className={styles.stagePanel} aria-hidden="true" />
          <PhoneFrameWithAppScreen screen="creatorProfileScreen" alt="TundeTech seller profile with a gold business badge, followers and a View Shop button" className={`${styles.phone} ${styles.phoneLeft}`} sizes="(min-width: 900px) 220px, 34vw" />
          <PhoneFrameWithAppScreen screen="homeFeedScreen" alt="Zudomart home feed showing a new Ankara collection post from Adaeze Okafor" className={`${styles.phone} ${styles.phoneCenter}`} priority sizes="(min-width: 900px) 280px, 46vw" />
          <PhoneFrameWithAppScreen screen="productDetailScreen" alt="Ankara wrap midi dress product page with its naira price, official store badge and Add to Cart" className={`${styles.phone} ${styles.phoneRight}`} sizes="(min-width: 900px) 220px, 34vw" />
          <p className={`${styles.floatingChip} ${styles.liveChip}`}>
            <span className={styles.liveDot} aria-hidden="true" />
            Live now: shop while you watch
          </p>
          <p className={`${styles.floatingChip} ${styles.escrowChip}`}>
            <span className={styles.currencyCoin}>
              <LocalCurrencySymbol />
            </span>
            <span>Your payment is held until you confirm delivery</span>
          </p>
        </div>
      </div>
    </section>
  );
}
