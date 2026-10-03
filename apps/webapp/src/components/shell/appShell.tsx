"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";

import { BellIcon, CartIcon, ChatIcon, CloseIcon, CompassIcon, HomeIcon, SearchIcon, UserIcon } from "@/components/ui/icons";
import { Avatar } from "@/components/ui/media";
import { ZudomartWordmark } from "@zudomart/web-kit";
import { useSession } from "@/components/providers/sessionProvider";
import { cartsService } from "@/services/carts.service";
import { messagesService } from "@/services/messages.service";
import { notificationsService } from "@/services/notifications.service";
import styles from "./appShell.module.css";

export interface NavItem {
  readonly href: string;
  readonly label: string;
  readonly icon: ReactNode;
  readonly badgeCount?: number;
}

export interface ShellBadgeCounts {
  readonly cart: number;
  readonly chats: number;
  readonly notifications: number;
}

function useShellBadgeCounts(): ShellBadgeCounts {
  const cartQuery = useQuery({ queryKey: ["shell", "cart"], queryFn: () => cartsService.fetchMyCart(), retry: false, staleTime: 20_000 });
  const chatQuery = useQuery({ queryKey: ["shell", "conversations"], queryFn: () => messagesService.fetchConversationList("all"), retry: false, staleTime: 20_000 });
  const notificationQuery = useQuery({
    queryKey: ["shell", "notifications"],
    queryFn: () => notificationsService.fetchMyNotifications(),
    retry: false,
    staleTime: 20_000,
  });

  return {
    cart: cartQuery.data?.items.reduce((total, item) => total + item.quantity, 0) ?? 0,
    chats: chatQuery.data?.reduce((total, conversation) => total + conversation.unread, 0) ?? 0,
    notifications: notificationQuery.data?.filter((notification) => !notification.read).length ?? 0,
  };
}

function formatBadgeCount(count: number): string {
  return count > 99 ? "99+" : String(count);
}

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

function BrandMark() {
  return (
    <Link href="/" className={styles.brand} aria-label="Zudomart home">
      <ZudomartWordmark />
    </Link>
  );
}

function NavList({ navItems, onNavigate }: { readonly navItems: readonly NavItem[]; readonly onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className={styles.navList}>
      {navItems.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              className={[styles.navItem, active ? styles.navItemActive : ""].filter(Boolean).join(" ")}
              aria-current={active ? "page" : undefined}
              onClick={onNavigate}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              <span className={styles.navLabel}>{item.label}</span>
              {item.badgeCount ? <span className={styles.navBadge}>{formatBadgeCount(item.badgeCount)}</span> : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function TopBar({ badgeCounts }: { readonly badgeCounts: ShellBadgeCounts }) {
  const { viewer } = useSession();
  return (
    <header className={styles.topBar}>
      <div className={styles.topBarInner}>
        <BrandMark />
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
          <Link href="/me" className={styles.avatarLink} aria-label="Your profile">
            <Avatar name={viewer?.name ?? "You"} src={viewer?.avatarUrl ?? null} size="sm" />
          </Link>
        </div>
      </div>
      <div className={styles.topBarSearchMobile}>
        <SearchBar />
      </div>
    </header>
  );
}

export function buildNavItems(viewerName: string | null, counts: ShellBadgeCounts): NavItem[] {
  return [
    { href: "/", label: "Home", icon: <HomeIcon /> },
    { href: "/explore", label: "Explore", icon: <CompassIcon /> },
    { href: "/cart", label: "Cart", icon: <CartIcon />, badgeCount: counts.cart },
    { href: "/chats", label: "Chats", icon: <ChatIcon />, badgeCount: counts.chats },
    { href: viewerName ? "/me" : "/login", label: "Me", icon: <UserIcon /> },
  ];
}

export function AppShell({ children }: { readonly children: ReactNode }) {
  const { viewer } = useSession();
  const counts = useShellBadgeCounts();
  const navItems = useMemo(() => buildNavItems(viewer?.name ?? null, counts), [viewer, counts]);

  return (
    <div className={styles.shell}>
      <aside className={styles.sideNav}>
        <BrandMark />
        <nav aria-label="Primary">
          <NavList navItems={navItems} />
        </nav>
        <div className={styles.sideNavFooter}>
          <span className={styles.sideNavHint}>web.zudomart.com</span>
        </div>
      </aside>

      <div className={styles.mainColumn}>
        <TopBar badgeCounts={counts} />
        <main id="main-content" className={styles.content} tabIndex={-1}>
          {children}
        </main>
      </div>

      <nav className={styles.bottomNav} aria-label="Primary">
        <NavList navItems={navItems} />
      </nav>
    </div>
  );
}
