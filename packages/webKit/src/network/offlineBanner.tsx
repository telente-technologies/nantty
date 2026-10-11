/** @jsxRuntime automatic */
/** @jsxImportSource react */
"use client";

import { useEffect, useRef, useState } from "react";

import { ErrorIcon } from "../errorExperience/errorIcons";
import { useIsOnline } from "./useIsOnline";
import styles from "./offlineBanner.module.css";

const backOnlineVisibleMilliseconds = 3500;

export function ConnectionStatus({ message = "You're offline. Check your data or Wi-Fi. We'll refresh this page when you reconnect." }: { readonly message?: string }) {
  const isOnline = useIsOnline();
  const wasOfflineRef = useRef(false);
  const [showBackOnline, setShowBackOnline] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      wasOfflineRef.current = true;
      setShowBackOnline(false);
      return;
    }
    if (!wasOfflineRef.current) return;
    wasOfflineRef.current = false;
    setShowBackOnline(true);
    const timer = window.setTimeout(() => setShowBackOnline(false), backOnlineVisibleMilliseconds);
    return () => window.clearTimeout(timer);
  }, [isOnline]);

  return (
    <>
      <div className={styles.offlineBanner} role="status" aria-live="polite" hidden={isOnline}>
        {isOnline ? null : (
          <>
            <ErrorIcon name="wifiSlash" size={16} weight="bold" />
            <span>{message}</span>
          </>
        )}
      </div>
      <div className={styles.backOnline} role="status" aria-live="polite" hidden={!showBackOnline}>
        {showBackOnline ? (
          <>
            <ErrorIcon name="checkCircle" size={18} weight="fill" />
            <span>You&apos;re back online</span>
          </>
        ) : null}
      </div>
    </>
  );
}

export const OfflineBanner = ConnectionStatus;
