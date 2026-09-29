import { FigmaIconTintedWithCurrentColor, type FigmaIconName } from "../ui/figmaIcon";
import { PhoneFrameWithAppScreen } from "../ui/phoneFrame";
import { SectionIntroWithEyebrowAndHeading } from "../ui/sectionIntro";
import styles from "./creatorProgramSection.module.css";

const creatorEarningStreams: ReadonlyArray<{ readonly icon: FigmaIconName; readonly title: string; readonly description: string }> = [
  { icon: "videoCamera24", title: "Go live and receive gifts", description: "Fans send gifts and tips during your lives, and they land in your creator earnings." },
  { icon: "tag24", title: "Affiliate commissions", description: "Promote products from sellers you trust. You earn a commission once the buyer's order is confirmed and escrow is released." },
  { icon: "play24", title: "Ad revenue share", description: "Earn a share of the revenue from ads shown alongside your posts and clips." },
  { icon: "userCircle24", title: "Subscriptions", description: "Offer monthly or yearly plans with subscriber-only clips, posts and lives for your biggest fans." },
];

export function CreatorProgramSection() {
  return (
    <section id="creators" className={styles.section} aria-labelledby="creators-heading">
      <div className={`pageContainer ${styles.layout}`}>
        <div className={styles.copyColumn}>
          <SectionIntroWithEyebrowAndHeading
            eyebrow="Creator Program"
            headingId="creators-heading"
            heading="Creators get paid here too."
            description="Join the Creator Program in the app and earn from the content you already make. Earnings show in your local currency and withdraw to your bank account."
          />
          <ul className={styles.streamList}>
            {creatorEarningStreams.map((creatorEarningStream) => (
              <li key={creatorEarningStream.title} className={styles.stream}>
                <span className={styles.streamIcon}>
                  <FigmaIconTintedWithCurrentColor name={creatorEarningStream.icon} size={22} />
                </span>
                <span>
                  <strong className={styles.streamTitle}>{creatorEarningStream.title}</strong>
                  <span className={styles.streamDescription}>{creatorEarningStream.description}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className={styles.visual}>
          <PhoneFrameWithAppScreen screen="creatorDashboardScreen" alt="Creator dashboard with monthly earnings split into gifts, affiliate commissions and bonuses, and top lives and posts" className={styles.phone} sizes="(min-width: 960px) 300px, 66vw" />
        </div>
      </div>
    </section>
  );
}
