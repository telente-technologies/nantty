import { OfficialStoreBadges } from "@nantty/web-kit";

import { isPrelaunchMode, storeLinks, webAppLink } from "@/lib/siteConfig.config";

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
  heading = isPrelaunchMode ? "Be there when Nantty opens." : "Shop the sellers you already watch.",
  description = isPrelaunchMode ? "Nantty is still in development. Join the waitlist for launch updates; app and web access will be announced when they are ready." : "Get Nantty on iPhone and Android, or open the web app and start shopping in your browser.",
  actionLabel = isPrelaunchMode ? "Join the waitlist" : webAppLink.label,
  actionHref = isPrelaunchMode ? "/waitlist" : webAppLink.href,
  sectionId = "download",
}: AppDownloadCallToActionProps) {
  const visibleStoreLinks = isPrelaunchMode ? { appStoreUrl: null, playStoreUrl: null } : storeLinks;
  return (
    <section id={sectionId} className={styles.section} aria-labelledby={headingId}>
      <div className="pageContainer">
        <div className={styles.panel}>
          <div className={styles.copyColumn}>
            <h2 id={headingId} className={styles.heading}>
              {heading}
            </h2>
            <p className={styles.description}>{description}</p>
            <ActionLinkStyledAsButton
              href={actionHref}
              appearance="onDark"
              opensInNewTab={actionHref === webAppLink.href}
              disabled={process.env.NANTTY_CLOUDFLARE_STATIC_EXPORT === "1" && actionHref === webAppLink.href}
            >
              {actionLabel}
            </ActionLinkStyledAsButton>
            <OfficialStoreBadges links={visibleStoreLinks} className={styles.storeBadges} />
          </div>
          <div className={styles.phoneColumn}>
            <PhoneFrameWithAppScreen screen="homeMartScreen" alt="Nantty Mart tab with Sales of the Day, Featured Brands and New Arrivals" className={styles.phone} sizes="(min-width: 960px) 320px, 70vw" />
          </div>
        </div>
      </div>
    </section>
  );
}
