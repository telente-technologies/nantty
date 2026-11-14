"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";

import { ActivityIcon, BookOpenIcon, ChatCircleTextIcon, ListMagnifyingGlassIcon, PlugsConnectedIcon, PlayCircleIcon, SquaresFourIcon, TestTubeIcon, type IconProps } from "@/components/ui/icons";

import styles from "./portalShell.module.css";

export interface PortalNavigationItem {
  readonly href: string;
  readonly label: string;
  readonly icon: "activity" | "book" | "messaging" | "requests" | "scenarios" | "testApps" | "webhook";
}

export interface PortalNavigationGroup {
  readonly label: string;
  readonly items: readonly PortalNavigationItem[];
}

const icons: Record<PortalNavigationItem["icon"], ComponentType<IconProps>> = {
  activity: ActivityIcon,
  book: BookOpenIcon,
  messaging: ChatCircleTextIcon,
  requests: ListMagnifyingGlassIcon,
  scenarios: PlayCircleIcon,
  testApps: TestTubeIcon,
  webhook: PlugsConnectedIcon,
};

export function PortalNavigation({ groups, mobile = false, onNavigate }: { readonly groups: readonly PortalNavigationGroup[]; readonly mobile?: boolean; readonly onNavigate?: () => void }) {
  const pathname = usePathname();
  const navigationClass = mobile ? styles.mobileNavigation : styles.navigation;

  return (
    <nav aria-label="Sandbox tools" className={navigationClass}>
      <ul className={styles.navigationList}>
        <li>
          <Link href="/" className={`${styles.navigationLink} ${mobile ? styles.mobileNavigationLink : ""}`} aria-current={pathname === "/" ? "page" : undefined} onClick={onNavigate}>
            <SquaresFourIcon size={19} weight={pathname === "/" ? "fill" : "regular"} />
            <span>Overview</span>
          </Link>
        </li>
        {groups.map((group) => (
          <li key={group.label} className={styles.navigationGroup}>
            <h2 className={`${styles.navigationGroupLabel} ${mobile ? styles.mobileNavigationGroupLabel : ""}`}>{group.label}</h2>
            <ul className={styles.navigationGroupList}>
              {group.items.map((item) => {
                const Icon = icons[item.icon];
                const current = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link href={item.href} className={`${styles.navigationLink} ${mobile ? styles.mobileNavigationLink : ""}`} aria-current={current ? "page" : undefined} onClick={onNavigate}>
                      <Icon size={19} weight={current ? "fill" : "regular"} />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </nav>
  );
}
