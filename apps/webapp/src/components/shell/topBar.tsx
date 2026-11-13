"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { BellIcon, CartIcon, SearchIcon } from "@/components/ui/icons";

import { ScopedSearchBar as SearchBar } from "./scopedSearchBar";
import { formatBadgeCount, type ShellBadgeCounts } from "./shellNavigation.config";
import styles from "./topBar.module.css";
import { UserMenu } from "./userMenu";

export function TopBar({ badgeCounts }: { readonly badgeCounts: ShellBadgeCounts }) {
  const isHome = usePathname() === "/";
  return (
    <header className={styles.topBar}>
      <div className={styles.topBarInner}>
        <div className={styles.topBarSearch}>
          <SearchBar />
        </div>
        <div className={styles.topBarActions}>
          {isHome ? (
            <Link href="/explore" className={styles.iconButton} aria-label="Search people, posts and products">
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
          <Link href="/cart" className={styles.iconButton} aria-label={`Cart${badgeCounts.cart ? `, ${badgeCounts.cart} items` : ""}`}>
            <CartIcon size={21} />
            {badgeCounts.cart ? <span className={styles.actionDot}>{formatBadgeCount(badgeCounts.cart)}</span> : null}
          </Link>
          <UserMenu />
        </div>
      </div>
      {!isHome ? <div className={styles.topBarSearchMobile}><SearchBar /></div> : null}
    </header>
  );
}
