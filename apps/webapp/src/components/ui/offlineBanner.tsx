"use client";

import { useIsOnline } from "./onlineStatus.hook";
import styles from "./feedback.module.css";

export function OfflineBanner() {
  const isOnline = useIsOnline();
  if (isOnline) return null;
  return (
    <div className={styles.offlineBanner} role="status">
      <span className={styles.offlineDot} aria-hidden="true" />
      You&apos;re offline. We&apos;ll refresh this page when you reconnect.
    </div>
  );
}
