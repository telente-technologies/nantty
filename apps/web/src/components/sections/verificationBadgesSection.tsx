import { FigmaIconTintedWithCurrentColor } from "../ui/figmaIcon";
import { PhoneFrameWithAppScreen } from "../ui/phoneFrame";
import { SectionIntroWithEyebrowAndHeading } from "../ui/sectionIntro";
import styles from "./verificationBadgesSection.module.css";

const verificationBadgeKinds = [
  {
    badgeClassName: styles.blueBadge,
    title: "Blue badge",
    audience: "People and creators",
    description: "The planned Blue badge is for a personal account approved through identity review.",
  },
  {
    badgeClassName: styles.goldBadge,
    title: "Gold badge",
    audience: "Businesses and brands",
    description: "The planned Gold badge is for a business or brand approved through business verification. Store eligibility is reviewed separately.",
  },
  {
    badgeClassName: styles.blackBadge,
    title: "Black badge",
    audience: "Government",
    description: "The planned Black badge is reserved for approved government institutions and authorized official accounts.",
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
            eyebrow="The planned verification model"
            headingId="badges-heading"
            heading="Verification should make identity clearer."
            description="Nantty is still in development. Verification requires separate review; a paid plan will not replace identity or business approval, and a badge will not guarantee a product or seller."
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
              <strong>Official stores.</strong> Nantty is designed to distinguish a brand’s official store from other sellers. Payment options and escrow protection will depend on the supported market and payment method.
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}
