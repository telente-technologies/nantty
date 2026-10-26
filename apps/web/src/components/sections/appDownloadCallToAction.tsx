import { OfficialStoreBadges } from "@nantty/web-kit";

import { storeLinks, webAppLink } from "@/lib/siteConfig.config";

import { ActionLinkStyledAsButton } from "../ui/actionLink";
import { PhoneFrameWithAppScreen } from "../ui/phoneFrame";
import styles from "./appDownloadCallToAction.module.css";

interface AppDownloadCallToActionProps {
  readonly headingId?: string;
  readonly heading?: string;
  readonly description?: string;
  readonly actionLabel?: string;
  readonly actionHref?: string;
  readonly sectionId?: string;
}

export function AppDownloadCallToActionPanel({
  headingId = "download-heading",
  heading = "Shop the sellers you already watch.",
  description = "Get Nantty on iPhone and Android, or open the web app and start shopping in your browser.",
  actionLabel = webAppLink.label,
  actionHref = webAppLink.href,
  sectionId = "download",
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
            <ActionLinkStyledAsButton href={actionHref} appearance="onDark" opensInNewTab>
              {actionLabel}
            </ActionLinkStyledAsButton>
            <OfficialStoreBadges links={storeLinks} className={styles.storeBadges} />
          </div>
          <div className={styles.phoneColumn}>
            <PhoneFrameWithAppScreen screen="homeMartScreen" alt="Nantty Mart tab with Sales of the Day, Featured Brands and New Arrivals" className={styles.phone} sizes="(min-width: 960px) 320px, 70vw" />
          </div>
        </div>
      </div>
    </section>
  );
}
