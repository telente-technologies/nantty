"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { PolicyUpdateHost } from "@/components/legal/policyUpdateHost";
import { HomeSectionProvider } from "@/components/home/homeSection.context";
import { useSession } from "@/components/providers/sessionProvider";
import { Avatar } from "@/components/ui/media";
import { OfflineBanner } from "@/components/ui/offlineBanner";
import type { User } from "@/types";

import styles from "./appShell.module.css";
import { RightRail } from "./rightRail";
import { describeShellLayoutForPath } from "./shellLayout.config";
import { buildBottomNavigationItems, buildSidebarNavigationGroups, formatBadgeCount, isNavItemActive, type NavItem } from "./shellNavigation.config";
import { SideNavigation } from "./sideNavigation";
import { TopBar } from "./topBar";
import { useShellBadgeCounts } from "./useShellBadgeCounts.hook";

const desktopNavCollapsedStorageKey = "nantty.webapp.desktopNavCollapsed";
const desktopMediaQuery = "(min-width: 1024px)";

function readStoredDesktopCollapse(): boolean {
  try {
    return window.localStorage.getItem(desktopNavCollapsedStorageKey) === "true";
  } catch {
    return false;
  }
}

function storeDesktopCollapse(isCollapsed: boolean): void {
  try {
    window.localStorage.setItem(desktopNavCollapsedStorageKey, String(isCollapsed));
  } catch {
    return;
  }
}

function BottomNavigation({ navItems, viewer }: { readonly navItems: readonly NavItem[]; readonly viewer: User | null }) {
  const pathname = usePathname();
  return (
    <nav className={styles.bottomNav} aria-label="Primary">
      <ul className={styles.bottomNavList}>
        {navItems.map((item) => {
          const active = isNavItemActive(item.href, pathname);
          return (
            <li key={item.href}>
              <Link href={item.href} className={[styles.bottomNavItem, active ? styles.bottomNavItemActive : "", item.href === "/post/new" ? styles.bottomNavCreate : ""].filter(Boolean).join(" ")} aria-current={active ? "page" : undefined} aria-label={item.label}>
                <span className={[styles.bottomNavIcon, item.href === "/post/new" ? styles.bottomNavCreateIcon : ""].filter(Boolean).join(" ")}>
                  {item.href === "/me" && viewer?.avatarUrl ? <Avatar name={viewer.name} src={viewer.avatarUrl} size="xs" ring={active} /> : active ? item.activeIcon ?? item.icon : item.icon}
                </span>
                <span className="visuallyHidden">{item.label}</span>
                {item.badgeCount ? <span className={styles.bottomNavBadge}>{formatBadgeCount(item.badgeCount)}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function useNavigationCollapseState() {
  const pathname = usePathname();
  const [isExpandedOnTablet, setIsExpandedOnTablet] = useState(false);
  const [isCollapsedOnDesktop, setIsCollapsedOnDesktop] = useState(false);

  useEffect(() => {
    setIsCollapsedOnDesktop(readStoredDesktopCollapse());
  }, []);

  useEffect(() => {
    setIsExpandedOnTablet(false);
  }, [pathname]);

  useEffect(() => {
    if (!isExpandedOnTablet) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsExpandedOnTablet(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isExpandedOnTablet]);

  const toggleNavigation = useCallback(() => {
    if (window.matchMedia(desktopMediaQuery).matches) {
      setIsCollapsedOnDesktop((collapsed) => {
        storeDesktopCollapse(!collapsed);
        return !collapsed;
      });
      return;
    }
    setIsExpandedOnTablet((expanded) => !expanded);
  }, []);

  return { isExpandedOnTablet, isCollapsedOnDesktop, toggleNavigation, closeTabletNavigation: () => setIsExpandedOnTablet(false) };
}

export function AppShell({ children }: { readonly children: ReactNode }) {
  const { viewer } = useSession();
  const pathname = usePathname();
  const isSignedIn = viewer !== null;
  const counts = useShellBadgeCounts(isSignedIn);
  const navigationGroups = useMemo(() => buildSidebarNavigationGroups(isSignedIn, counts), [isSignedIn, counts]);
  const bottomNavItems = useMemo(() => buildBottomNavigationItems(isSignedIn, counts), [isSignedIn, counts]);
  const layout = describeShellLayoutForPath(pathname);
  const { isExpandedOnTablet, isCollapsedOnDesktop, toggleNavigation, closeTabletNavigation } = useNavigationCollapseState();
  const hasRightRail = layout.rightRailVisibility !== "none" && layout.rightRailModules.length > 0;

  const shellClasses = [styles.shell, isCollapsedOnDesktop ? styles.shellNavCollapsed : ""].join(" ");
  const bodyClasses = [
    styles.body,
    styles[`content_${layout.contentWidth}`],
    hasRightRail ? styles[`rail_${layout.rightRailVisibility}`] : "",
    pathname === "/" ? styles.bodyHome : "",
  ].join(" ");

  return (
    <HomeSectionProvider>
      <div className={shellClasses}>
        <SideNavigation
          navigationGroups={navigationGroups}
          isExpandedOnTablet={isExpandedOnTablet}
          isCollapsedOnDesktop={isCollapsedOnDesktop}
          onToggle={toggleNavigation}
          onNavigate={closeTabletNavigation}
        />
        {isExpandedOnTablet ? <div className={styles.navScrim} onClick={closeTabletNavigation} aria-hidden="true" /> : null}

        <div className={styles.mainColumn}>
          <TopBar badgeCounts={counts} />
          <OfflineBanner />
          <PolicyUpdateHost />
          <div className={bodyClasses}>
            <main id="main-content" className={styles.content} tabIndex={-1}>
              {children}
            </main>
            {hasRightRail ? (
              <div className={styles.railSlot}>
                <RightRail modules={isSignedIn ? layout.rightRailModules : layout.rightRailModules.filter((moduleName) => moduleName === "trending" || moduleName === "suggestedAccounts")} />
              </div>
            ) : null}
          </div>
        </div>

        <BottomNavigation navItems={bottomNavItems} viewer={viewer} />
      </div>
    </HomeSectionProvider>
  );
}
