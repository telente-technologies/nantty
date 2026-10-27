import { NanttyIcon } from "@/components/ui/nanttyIcon";

import styles from "./landingIllustrations.module.css";

export function StoreIdentityRow({ storeName, inverted = false, labelText = "Sponsored", isVerifiedBusiness = true }: { readonly storeName: string; readonly inverted?: boolean; readonly labelText?: string; readonly isVerifiedBusiness?: boolean }) {
  return (
    <div className={inverted ? `${styles.identityRow} ${styles.identityRowInverted}` : styles.identityRow}>
      <span className={styles.identityAvatar} aria-hidden>
        {storeName.slice(0, 1)}
      </span>
      <span className={styles.identityName}>{storeName}</span>
      {isVerifiedBusiness ? <NanttyIcon name="sealCheck20" size={13} className={styles.identitySeal} label="Verified business" /> : null}
      <span className={styles.identityLabel}>{labelText}</span>
    </div>
  );
}

export function CallToActionBar({ label }: { readonly label: string }) {
  return (
    <span className={styles.callToActionBar} aria-hidden>
      {label}
    </span>
  );
}

export function AdBadge() {
  return <span className={styles.adBadge}>Ad</span>;
}
