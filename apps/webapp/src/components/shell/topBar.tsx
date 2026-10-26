"use client";

import Link from "next/link";

import { BellIcon, CartIcon } from "@/components/ui/icons";

import { ScopedSearchBar as SearchBar } from "./scopedSearchBar";
import { formatBadgeCount, type ShellBadgeCounts } from "./shellNavigation.config";
import styles from "./topBar.module.css";
import { UserMenu } from "./userMenu";

export function TopBar({ badgeCounts }: { readonly badgeCounts: ShellBadgeCounts }) {
  return (
    <header className={styles.topBar}>
      <div className={styles.topBarInner}>
        <div className={styles.topBarSearch}>
          <SearchBar />
        </div>
        <div className={styles.topBarActions}>
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
      <div className={styles.topBarSearchMobile}>
        <SearchBar />
      </div>
    </header>
  );
}
