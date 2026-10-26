"use client";

import Link from "next/link";
import { useState } from "react";

import { ThemeSwitcher, NanttyLogoMark } from "@nantty/web-kit";

import { CompactWorkspaceSwitcher } from "@/components/layout/compactWorkspaceSwitcher";
import { StoreSwitcher } from "@/components/layout/storeSwitcher";
import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { IconButton } from "@/components/ui/button";
import { ZudoIcon } from "@/components/ui/zudoIcon";
import { staffRoleLabels } from "@/constants/roles.constant";
import { useStoreContext } from "@/hooks/useStoreSettings.hook";
import { signOutOfDashboardAndClearCachedPages } from "@/services/signOut.service";

import styles from "./topBar.module.css";

export function TopBar({ onOpenNavigation, onOpenCommandPalette }: { readonly onOpenNavigation: () => void; readonly onOpenCommandPalette: () => void }) {
  const { sessionView } = useSellerSession();
  const { locations, selectedLocationId, selectLocation } = useStoreContext();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const displayName = sessionView?.user.name ?? sessionView?.user.username ?? "You";

  async function signOutOfDashboard() {
    setIsSigningOut(true);
    await signOutOfDashboardAndClearCachedPages();
  }

  return (
    <header className={`${styles.topBar} noPrint`}>
      <IconButton iconName="textIndent24" label="Open navigation" className={styles.menuButton} onClick={onOpenNavigation} />
      <Link href="/dashboard" className={styles.compactBrand} aria-label="Nantty Dashboard overview">
        <NanttyLogoMark size={28} />
      </Link>
      <div className={styles.wideOnly}>
        <StoreSwitcher />
      </div>
      <div className={styles.compactOnly}>
        <CompactWorkspaceSwitcher />
      </div>
      {locations.length > 0 ? (
        <label className={`${styles.locationSwitcher} ${styles.wideOnlyFlex}`}>
          <ZudoIcon name="mapPin24" size={16} />
          <span className="visuallyHidden">Current location</span>
          <select value={selectedLocationId ?? ""} onChange={(event) => void selectLocation(event.target.value)} className={styles.locationSelect}>
            {locations.filter((location) => location.active).map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <button type="button" className={styles.commandButton} onClick={onOpenCommandPalette} aria-label="Search or jump to a page" aria-keyshortcuts="Control+K">
        <ZudoIcon name="magnifyingGlass20" size={16} />
        <span className={styles.commandLabel}>Search or jump to…</span>
        <kbd className={styles.shortcut}>Ctrl K</kbd>
      </button>
      <a href={`${process.env.NEXT_PUBLIC_WEBAPP_URL ?? "https://web.nantty.com"}/help/selling`} className={styles.commandButton} target="_blank" rel="noopener noreferrer" aria-label="Help, opens in a new tab">
        <ZudoIcon name="question24" size={16} />
        <span className={styles.commandLabel}>Help</span>
      </a>
      <ThemeSwitcher iconOnly label="Colour theme" className={styles.themeSwitcher} />
      <div className={styles.account}>
        <span className={styles.avatar} aria-hidden="true">
          {displayName.slice(0, 1).toUpperCase()}
        </span>
        <span className={styles.accountText}>
          <span className={styles.accountName}>{displayName}</span>
          <span className={styles.accountRole}>{sessionView?.effectiveRole ? staffRoleLabels[sessionView.effectiveRole] : ""}</span>
        </span>
        <IconButton iconName="signOut24" label="Sign out" size="small" onClick={() => void signOutOfDashboard()} disabled={isSigningOut} />
      </div>
    </header>
  );
}
