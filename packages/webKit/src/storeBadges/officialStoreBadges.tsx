import type { StoreLinks } from "./storeLinks";
import styles from "./officialStoreBadges.module.css";

const appleAspect = 119.66407 / 40;
const googleVisibleHeightRatio = 168 / 250;
const googleAspect = 646 / 250;

interface OfficialStoreBadgesProps {
  readonly links: StoreLinks;
  readonly height?: number;
  readonly assetBasePath?: string;
  readonly comingSoonLabel?: string;
  readonly align?: "start" | "center";
  readonly className?: string;
}

function BadgeSlot({ href, label, children }: { readonly href: string | null; readonly label: string; readonly children: React.ReactNode }) {
  if (!href) return <span className={styles.slot}>{children}</span>;
  return (
    <a className={`${styles.slot} ${styles.link}`} href={href} target="_blank" rel="noopener noreferrer" aria-label={label}>
      {children}
    </a>
  );
}

export function OfficialStoreBadges({ links, height = 40, assetBasePath = "/storeBadges", comingSoonLabel = "Coming soon", align = "start", className }: OfficialStoreBadgesProps) {
  const badgeHeight = Math.max(40, height);
  const clearSpace = badgeHeight / 4;
  const googleImageHeight = badgeHeight / googleVisibleHeightRatio;
  const isComingSoon = !links.appStoreUrl && !links.playStoreUrl;
  return (
    <div className={[styles.group, align === "center" ? styles.center : "", className ?? ""].join(" ")}>
      <ul className={styles.list} aria-label={isComingSoon ? `${comingSoonLabel} to the App Store and Google Play` : "Get the Zudomart app"}>
        <li style={{ padding: clearSpace }}>
          <BadgeSlot href={links.appStoreUrl} label="Download on the App Store">
            <img src={`${assetBasePath}/app-store-badge-black.svg`} alt="Download on the App Store" width={Math.round(badgeHeight * appleAspect)} height={badgeHeight} className={styles.image} />
          </BadgeSlot>
        </li>
        <li>
          <BadgeSlot href={links.playStoreUrl} label="Get it on Google Play">
            <img src={`${assetBasePath}/google-play-badge.png`} alt="Get it on Google Play" width={Math.round(googleImageHeight * googleAspect)} height={Math.round(googleImageHeight)} className={styles.image} />
          </BadgeSlot>
        </li>
      </ul>
      {isComingSoon || !links.appStoreUrl || !links.playStoreUrl ? <p className={styles.note}>{comingSoonLabel}</p> : null}
    </div>
  );
}
