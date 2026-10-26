"use client";

import { useEffect, useRef, useState } from "react";

import { ThemeSwitcher } from "@nantty/web-kit";

import { useAdsSession } from "@/components/session/adsSessionProvider";
import { accountsApi } from "@/services/accountsApi.service";

import styles from "./userMenu.module.css";

export function UserMenu() {
  const session = useAdsSession();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const displayName = session?.user.name ?? session?.user.username ?? "You";
  const menuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function closeMenu(event: PointerEvent | KeyboardEvent) {
      const menu = menuRef.current;
      if (!menu?.open) return;
      if (event instanceof KeyboardEvent) {
        if (event.key !== "Escape") return;
        menu.open = false;
        menu.querySelector("summary")?.focus();
        return;
      }
      if (!menu.contains(event.target as Node)) menu.open = false;
    }
    document.addEventListener("pointerdown", closeMenu);
    document.addEventListener("keydown", closeMenu);
    return () => {
      document.removeEventListener("pointerdown", closeMenu);
      document.removeEventListener("keydown", closeMenu);
    };
  }, []);

  async function signOutAndReturnToLogin() {
    setIsSigningOut(true);
    try {
      await accountsApi.signOut();
    } finally {
      window.location.assign("/login");
    }
  }

  return (
    <details className={styles.menu} ref={menuRef}>
      <summary className={styles.trigger} aria-label={`Signed in as ${displayName}`}>
        <span className={styles.avatar} aria-hidden>
          {displayName.slice(0, 1).toUpperCase()}
        </span>
      </summary>
      <div className={styles.panel}>
        <p className={styles.name}>{displayName}</p>
        {session?.user.email ? <p className={styles.detail}>{session.user.email}</p> : null}
        <ThemeSwitcher label="Theme" showLabel className={styles.themeSwitcher} />
        <button type="button" className={styles.signOutButton} onClick={signOutAndReturnToLogin} disabled={isSigningOut}>
          {isSigningOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </details>
  );
}
