import type { WaitlistRole } from "@/types/waitlist.types";

import { FigmaIconTintedWithCurrentColor } from "../ui/figmaIcon";
import { PhoneFrameWithAppScreen } from "../ui/phoneFrame";
import styles from "./appDownloadCallToAction.module.css";
import { WaitlistEmailSignupForm } from "./waitlistForm";

interface AppDownloadCallToActionProps {
  readonly headingId?: string;
  readonly heading?: string;
  readonly description?: string;
  readonly defaultRole?: WaitlistRole;
  readonly source?: string;
  readonly sectionId?: string;
}

export function AppDownloadCallToActionPanel({
  headingId = "waitlist-heading",
  heading = "Be first in when the doors open.",
  description = "Zudomart is coming to iPhone and Android. Join the waitlist and we'll send one email with your download link when we launch in your city.",
  defaultRole = "buyer",
  source = "web-cta",
  sectionId = "waitlist",
}: AppDownloadCallToActionProps) {
  return (
    <section id={sectionId} className={styles.section} aria-labelledby={headingId}>
      <div className="pageContainer">
        <div className={styles.panel}>
          <div className={styles.copyColumn}>
            <h2 id={headingId} className={styles.heading}>
              {heading}
            </h2>
            <p className={styles.description}>{description}</p>
            <WaitlistEmailSignupForm source={source} defaultRole={defaultRole} showRolePicker tone="dark" />
            <ul className={styles.storeList} aria-label="Coming soon to">
              <li className={styles.storeBadge}>
                <FigmaIconTintedWithCurrentColor name="apple24" size={22} />
                <span>
                  <small>Coming soon</small>
                  App Store
                </span>
              </li>
              <li className={styles.storeBadge}>
                <FigmaIconTintedWithCurrentColor name="play24" size={20} />
                <span>
                  <small>Coming soon</small>
                  Google Play
                </span>
              </li>
            </ul>
          </div>
          <div className={styles.phoneColumn}>
            <PhoneFrameWithAppScreen screen="onboardingScreen" alt="Zudomart welcome screen: discover real sellers around you, with Apple, Google and username sign-in" className={styles.phone} sizes="(min-width: 960px) 320px, 70vw" />
          </div>
        </div>
      </div>
    </section>
  );
}
