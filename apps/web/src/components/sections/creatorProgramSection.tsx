import { FigmaIconTintedWithCurrentColor, type FigmaIconName } from "../ui/figmaIcon";
import { PhoneFrameWithAppScreen } from "../ui/phoneFrame";
import { SectionIntroWithEyebrowAndHeading } from "../ui/sectionIntro";
import styles from "./creatorProgramSection.module.css";

const creatorEarningStreams: ReadonlyArray<{ readonly icon: FigmaIconName; readonly title: string; readonly description: string }> = [
  { icon: "videoCamera24", title: "Video LIVE is in beta", description: "Live video is a gated beta capability while we improve it; it is not part of the initial launch. Creator Program approval is required to host." },
  { icon: "tag24", title: "Affiliate tools are being built", description: "The planned affiliate flow will attribute eligible completed purchases to a creator’s link. Escrow or pending orders do not earn a commission." },
  { icon: "play24", title: "Creator monetisation is evolving", description: "Advertising revenue sharing and other earning tools depend on program approval, eligibility, feature availability and the final Creator Program terms." },
  { icon: "userCircle24", title: "Fan subscriptions are in development", description: "Subscription-only posts and clips are part of the product direction, subject to launch readiness and the final feature rules." },
];

export function CreatorProgramSection() {
  return (
    <section id="creators" className={styles.section} aria-labelledby="creators-heading">
      <div className={`pageContainer ${styles.layout}`}>
        <div className={styles.copyColumn}>
          <SectionIntroWithEyebrowAndHeading
            eyebrow="Creator tools in development"
            headingId="creators-heading"
            heading="A home for the work creators already do."
            description="We’re building creator tools alongside the marketplace. Some features are still in development or beta, require separate approval, and may change before launch. No earnings are guaranteed."
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
          <PhoneFrameWithAppScreen screen="creatorDashboardScreen" alt="Preview of a Nantty creator dashboard concept showing earnings, content and creator tools" className={styles.phone} sizes="(min-width: 960px) 300px, 66vw" />
        </div>
      </div>
    </section>
  );
}
