import { FigmaIconTintedWithCurrentColor } from "../ui/figmaIcon";
import { PhoneFrameWithAppScreen } from "../ui/phoneFrame";
import { SectionIntroWithEyebrowAndHeading } from "../ui/sectionIntro";
import styles from "./verificationBadgesSection.module.css";

const verificationBadgeKinds = [
  {
    badgeClassName: styles.blueBadge,
    title: "Blue badge",
    audience: "People and creators",
    description: "A personal account whose identity Nantty has checked.",
  },
  {
    badgeClassName: styles.goldBadge,
    title: "Gold badge",
    audience: "Businesses and brands",
    description: "A verified business. Gold brands can run an official store, so you know the product comes from the brand itself.",
  },
  {
    badgeClassName: styles.blackBadge,
    title: "Black badge",
    audience: "Government",
    description: "An official government body or public institution, such as a ministry or regulator.",
  },
] as const;

export function VerificationBadgesSection() {
  return (
    <section id="badges" className={styles.section} aria-labelledby="badges-heading">
      <div className={`pageContainer ${styles.layout}`}>
        <div className={styles.visual}>
          <PhoneFrameWithAppScreen screen="productDetailScreen" alt="Product page from Adire House showing a gold verified badge and an Official Store label" className={styles.phone} sizes="(min-width: 960px) 280px, 60vw" />
        </div>
        <div className={styles.copyColumn}>
          <SectionIntroWithEyebrowAndHeading
            eyebrow="Badges and official stores"
            headingId="badges-heading"
            heading="Know exactly who you are buying from."
            description="Verification badges tell you who is behind an account. Brands can claim their profile and open an official store, and fakes can be reported from any product or post."
          />
          <ul className={styles.badgeList}>
            {verificationBadgeKinds.map((verificationBadgeKind) => (
              <li key={verificationBadgeKind.title} className={styles.badgeCard}>
                <FigmaIconTintedWithCurrentColor name="sealCheck20" size={28} className={verificationBadgeKind.badgeClassName} />
                <p className={styles.badgeAudience}>{verificationBadgeKind.audience}</p>
                <h3 className={styles.badgeTitle}>{verificationBadgeKind.title}</h3>
                <p className={styles.badgeDescription}>{verificationBadgeKind.description}</p>
              </li>
            ))}
          </ul>
          <p className={styles.officialStoreNote}>
            <FigmaIconTintedWithCurrentColor name="buildingStore20" size={20} />
            <span>
              <strong>Brands and official stores.</strong> Look for the Official Store label on product pages. Every order, from a small seller or a big brand, is paid in your local currency and held in escrow until you confirm delivery.
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}
