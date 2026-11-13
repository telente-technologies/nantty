"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { BellIcon, CartIcon, SearchIcon, SpacesIcon } from "@/components/ui/icons";
import { HomeSectionTabs } from "@/components/home/homeSectionTabs";

import { ScopedSearchBar as SearchBar } from "./scopedSearchBar";
import { formatBadgeCount, type ShellBadgeCounts } from "./shellNavigation.config";
import styles from "./topBar.module.css";
import { UserMenu } from "./userMenu";

export function TopBar({ badgeCounts }: { readonly badgeCounts: ShellBadgeCounts }) {
  const isHome = usePathname() === "/";
  return (
    <header className={[styles.topBar, isHome ? styles.topBarHome : ""].filter(Boolean).join(" ")}>
      <div className={styles.topBarInner}>
        <div className={styles.topBarSearch}>
          <SearchBar />
        </div>
        {isHome ? <div className={styles.homeTabs}><HomeSectionTabs compact idPrefix="mobile-home-section" /></div> : null}
        <div className={styles.topBarActions}>
          {isHome ? (
            <Link href="/explore" className={[styles.iconButton, styles.homeSearchButton].join(" ")} aria-label="Search people, posts and products">
              <SearchIcon size={21} />
            </Link>
          ) : null}
          <Link
            href="/notifications"
            className={styles.iconButton}
            aria-label={`Notifications${badgeCounts.notifications ? `, ${badgeCounts.notifications} unread` : ""}`}
          >
            <BellIcon size={21} />
            {badgeCounts.notifications ? <span className={styles.actionDot}>{formatBadgeCount(badgeCounts.notifications)}</span> : null}
          </Link>
          {!isHome || badgeCounts.cart > 0 ? (
            <Link href="/cart" className={styles.iconButton} aria-label={`Cart${badgeCounts.cart ? `, ${badgeCounts.cart} items` : ""}`}>
              <CartIcon size={21} />
              {badgeCounts.cart ? <span className={styles.actionDot}>{formatBadgeCount(badgeCounts.cart)}</span> : null}
            </Link>
          ) : null}
          {isHome ? (
            <Link href="/spaces" className={[styles.iconButton, styles.homeSpacesButton].join(" ")} aria-label="Explore Spaces">
              <SpacesIcon size={21} />
            </Link>
          ) : null}
          {isHome ? <span className={styles.homeDesktopUser}><UserMenu /></span> : <UserMenu />}
        </div>
      </div>
      {!isHome ? <div className={styles.topBarSearchMobile}><SearchBar /></div> : null}
    </header>
  );
}
