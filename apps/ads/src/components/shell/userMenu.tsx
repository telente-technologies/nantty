"use client";

import { useState } from "react";

import { useAdsSession } from "@/components/session/adsSessionProvider";
import { accountsApi } from "@/services/accountsApi.service";

import styles from "./userMenu.module.css";

export function UserMenu() {
  const session = useAdsSession();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const displayName = session?.user.name ?? session?.user.username ?? "You";

  async function signOutAndReturnToLogin() {
    setIsSigningOut(true);
    try {
      await accountsApi.signOut();
    } finally {
      window.location.assign("/login");
    }
  }

  return (
    <details className={styles.menu}>
      <summary className={styles.trigger} aria-label={`Signed in as ${displayName}`}>
        <span className={styles.avatar} aria-hidden>
          {displayName.slice(0, 1).toUpperCase()}
        </span>
      </summary>
      <div className={styles.panel}>
        <p className={styles.name}>{displayName}</p>
        {session?.user.email ? <p className={styles.detail}>{session.user.email}</p> : null}
        <button type="button" className={styles.signOutButton} onClick={signOutAndReturnToLogin} disabled={isSigningOut}>
          {isSigningOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </details>
  );
}
