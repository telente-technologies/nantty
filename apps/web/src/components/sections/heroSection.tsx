import { FigmaIconTintedWithCurrentColor } from "../ui/figmaIcon";
import { LocalCurrencySymbol } from "../ui/localCurrencySymbol";
import { PhoneFrameWithAppScreen } from "../ui/phoneFrame";
import styles from "./heroSection.module.css";
import { WaitlistEmailSignupForm } from "./waitlistForm";

export function HomeHeroSectionWithPhoneStage() {
  return (
    <section className={styles.hero} aria-labelledby="hero-heading">
      <div className={`pageContainer ${styles.layout}`}>
        <div className={styles.copyColumn}>
          <p className="eyebrowLabel">Social shopping, made for Nigeria</p>
          <h1 id="hero-heading" className={styles.heading}>
            Shop the sellers you already <span className={styles.priceTag}>watch.</span>
          </h1>
          <p className={styles.lede}>
            Find real sellers through posts, clips, stories and live streams. Pay in your local currency, and your money stays in escrow until you confirm your order arrived.
          </p>
          <WaitlistEmailSignupForm source="web-hero" submitLabel="Get early access" />
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
          <PhoneFrameWithAppScreen screen="creatorProfileScreen" alt="Zudomart seller profile with posts, followers and a store tab" className={`${styles.phone} ${styles.phoneLeft}`} sizes="(min-width: 900px) 220px, 34vw" />
          <PhoneFrameWithAppScreen screen="homeFeedScreen" alt="Zudomart home feed showing posts from sellers and friends" className={`${styles.phone} ${styles.phoneCenter}`} priority sizes="(min-width: 900px) 280px, 46vw" />
          <PhoneFrameWithAppScreen screen="productDetailScreen" alt="Zudomart product page with price and add to cart" className={`${styles.phone} ${styles.phoneRight}`} sizes="(min-width: 900px) 220px, 34vw" />
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
