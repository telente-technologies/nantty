"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NanttyLogoMark, NanttyWordmark } from "@nantty/web-kit";

import { SidebarToggleIcon } from "@/components/ui/icons";

import { formatBadgeCount, isNavItemActive, type NavItem } from "./shellNavigation.config";
import styles from "./sideNavigation.module.css";

interface SideNavigationProps {
  readonly navigationGroups: readonly (readonly NavItem[])[];
  readonly isExpandedOnTablet: boolean;
  readonly isCollapsedOnDesktop: boolean;
  readonly onToggle: () => void;
  readonly onNavigate: () => void;
}

export function SideNavigation({ navigationGroups, isExpandedOnTablet, isCollapsedOnDesktop, onToggle, onNavigate }: SideNavigationProps) {
  const pathname = usePathname();
  const stateClasses = [styles.sideNav, isExpandedOnTablet ? styles.expandedOnTablet : "", isCollapsedOnDesktop ? styles.collapsedOnDesktop : ""].join(" ");

  return (
    <aside className={stateClasses} id="primary-navigation">
      <div className={styles.brandRow}>
        <Link href="/" className={styles.brand} aria-label="Nantty home" onClick={onNavigate}>
          <NanttyLogoMark size={36} className={styles.brandMark} />
          <span className={styles.brandWordmark}>
            <NanttyWordmark height={30} />
          </span>
        </Link>
      </div>

      <nav aria-label="Primary" className={styles.nav}>
        {navigationGroups.map((group, groupIndex) => (
          <ul className={styles.navGroup} key={groupIndex}>
            {group.map((item) => {
              const active = isNavItemActive(item.href, pathname);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={[styles.navItem, active ? styles.navItemActive : ""].join(" ")}
                    aria-current={active ? "page" : undefined}
                    title={item.label}
                    onClick={onNavigate}
                  >
                    <span className={styles.navIcon}>
                      {item.icon}
                      {item.badgeCount ? <span className={styles.navDot} aria-hidden="true" /> : null}
                    </span>
                    <span className={styles.navLabel}>{item.label}</span>
                    {item.badgeCount ? (
                      <span className={styles.navBadge}>
                        {formatBadgeCount(item.badgeCount)}
                        <span className="visuallyHidden"> unread</span>
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        ))}
      </nav>

      <button
        type="button"
        className={styles.toggle}
        onClick={onToggle}
        aria-controls="primary-navigation"
        aria-expanded={isExpandedOnTablet || !isCollapsedOnDesktop}
        title="Collapse or expand navigation"
      >
        <SidebarToggleIcon size={20} />
        <span className={styles.toggleLabel}>Collapse menu</span>
        <span className="visuallyHidden">Toggle navigation labels</span>
      </button>
    </aside>
  );
}
