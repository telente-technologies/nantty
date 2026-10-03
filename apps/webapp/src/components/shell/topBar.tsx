"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ZudomartWordmark } from "@zudomart/web-kit";

import { BellIcon, CartIcon, CloseIcon, SearchIcon } from "@/components/ui/icons";

import { formatBadgeCount, type ShellBadgeCounts } from "./shellNavigation.config";
import styles from "./topBar.module.css";
import { UserMenu } from "./userMenu";

function SearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");

  useEffect(() => {
    setValue(searchParams.get("q") ?? "");
  }, [searchParams]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = value.trim();
    router.push(query ? `/explore?q=${encodeURIComponent(query)}` : "/explore");
  }

  return (
    <form className={styles.searchBar} role="search" onSubmit={handleSubmit}>
      <SearchIcon size={18} className={styles.searchIcon} />
      <input
        type="search"
        className={styles.searchInput}
        placeholder="Search products, stores, people"
        aria-label="Search Zudomart"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      {value ? (
        <button type="button" className={styles.searchClear} onClick={() => setValue("")} aria-label="Clear search">
          <CloseIcon size={16} />
        </button>
      ) : null}
    </form>
  );
}

export function TopBar({ badgeCounts }: { readonly badgeCounts: ShellBadgeCounts }) {
  return (
    <header className={styles.topBar}>
      <div className={styles.topBarInner}>
        <Link href="/" className={styles.brand} aria-label="Zudomart home">
          <ZudomartWordmark />
        </Link>
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
