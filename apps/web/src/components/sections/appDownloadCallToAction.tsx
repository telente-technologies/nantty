import { OfficialStoreBadges } from "@zudomart/web-kit";

import { storeLinks } from "@/lib/siteConfig.config";
import type { WaitlistRole } from "@/types/waitlist.types";

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
            <OfficialStoreBadges links={storeLinks} className={styles.storeBadges} />
          </div>
          <div className={styles.phoneColumn}>
            <PhoneFrameWithAppScreen screen="homeMartScreen" alt="Zudomart Mart tab with Sales of the Day, Featured Brands and New Arrivals" className={styles.phone} sizes="(min-width: 960px) 320px, 70vw" />
          </div>
        </div>
      </div>
    </section>
  );
}
