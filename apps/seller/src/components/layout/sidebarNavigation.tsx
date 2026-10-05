"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ZudomartWordmark } from "@zudomart/web-kit";

import { FeaturePlanBadge } from "@/components/billing/planGate";
import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { ZudoIcon } from "@/components/ui/zudoIcon";
import type { NavigationGroup } from "@/config/navigation.config";

import styles from "./sidebarNavigation.module.css";

export function DashboardWordmark({ height = 22, withSymbol = true }: { readonly height?: number; readonly withSymbol?: boolean }) {
  return <ZudomartWordmark productLabel="Dashboard" tone="onDark" height={height} withSymbol={withSymbol} />;
}

export function SidebarNavigation({ groups, isOpenOnSmallScreens, onNavigate }: { readonly groups: NavigationGroup[]; readonly isOpenOnSmallScreens: boolean; readonly onNavigate: () => void }) {
  const pathname = usePathname();
  const { can } = useSellerSession();
  const visibleGroups = groups
    .map((group) => ({ ...group, items: group.items.filter((item) => can(item.permission)) }))
    .filter((group) => group.items.length > 0);

  return (
    <aside className={`${styles.sidebar} ${isOpenOnSmallScreens ? styles.open : ""} noPrint`} aria-label="Main">
      <Link href="/" className={styles.brandLink} onClick={onNavigate}>
        <DashboardWordmark />
      </Link>
      <nav className={styles.navigation}>
        {visibleGroups.map((group) => (
          <div key={group.label ?? "top"} className={styles.group}>
            {group.label ? <p className={styles.groupLabel}>{group.label}</p> : null}
            <ul>
              {group.items.map((item) => {
                const isActive = !item.external && (pathname === item.href || pathname.startsWith(`${item.href}/`));
                return (
                  <li key={item.href}>
                    {item.external ? (
                      <a href={item.href} className={styles.link} target="_blank" rel="noopener noreferrer">
                        <ZudoIcon name={item.iconName} size={18} />
                        <span className={styles.linkLabel}>{item.label}</span>
                        <ZudoIcon name="arrowUpRight24" size={14} className={styles.externalMark} />
                      </a>
                    ) : (
                      <Link href={item.href} className={styles.link} aria-current={isActive ? "page" : undefined} onClick={onNavigate}>
                        <ZudoIcon name={item.iconName} size={18} />
                        <span className={styles.linkLabel}>{item.label}</span>
                        {item.feature ? <FeaturePlanBadge feature={item.feature} /> : null}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
