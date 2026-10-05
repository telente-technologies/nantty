"use client";

import { useIsOnline } from "./useIsOnline";
import styles from "./offlineBanner.module.css";

export function OfflineBanner({ message = "You're offline. We'll refresh this page when you reconnect." }: { readonly message?: string }) {
  const isOnline = useIsOnline();
  if (isOnline) return null;
  return (
    <div className={styles.offlineBanner} role="status" aria-live="polite">
      <span className={styles.offlineDot} aria-hidden="true" />
      {message}
    </div>
  );
}
