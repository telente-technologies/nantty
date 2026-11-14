"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";

import { ActivityIcon, BookOpenIcon, BriefcaseIcon, ChatCircleTextIcon, KeyIcon, ListMagnifyingGlassIcon, PlugsConnectedIcon, SquaresFourIcon, type IconProps } from "@/components/ui/icons";
import { readDeveloperDocsHref } from "@/config/site.config";

import styles from "./portalShell.module.css";

export interface PortalNavigationItem {
  readonly href: string;
  readonly label: string;
  readonly icon: "activity" | "book" | "briefcase" | "key" | "messaging" | "requests" | "usage" | "webhook";
}

export interface PortalNavigationGroup {
  readonly label: string;
  readonly items: readonly PortalNavigationItem[];
}

const icons: Record<PortalNavigationItem["icon"], ComponentType<IconProps>> = {
  activity: ActivityIcon,
  book: BookOpenIcon,
  briefcase: BriefcaseIcon,
  key: KeyIcon,
  messaging: ChatCircleTextIcon,
  requests: ListMagnifyingGlassIcon,
  usage: ActivityIcon,
  webhook: PlugsConnectedIcon,
};

export function PortalNavigation({ groups, homeHref = "/", onNavigate }: { readonly groups: readonly PortalNavigationGroup[]; readonly homeHref?: string; readonly onNavigate?: () => void }) {
  const pathname = usePathname();
  const homeIsCurrent = pathname === homeHref;

  return (
    <nav aria-label="Developer portal" className={styles.navigation}>
      <ul className={styles.navigationList}>
        <li>
          <Link href={homeHref} className={styles.navigationLink} aria-current={homeIsCurrent ? "page" : undefined} onClick={onNavigate}>
            <SquaresFourIcon size={19} weight={homeIsCurrent ? "fill" : "regular"} />
            <span>Overview</span>
          </Link>
        </li>
        {groups.map((group) => (
          <li key={group.label} className={styles.navigationGroup}>
            <h2 className={styles.navigationGroupLabel}>{group.label}</h2>
            <ul className={styles.navigationGroupList}>
              {group.items.map((item) => {
                const Icon = icons[item.icon];
                const href = item.href === "/docs"
                  ? readDeveloperDocsHref()
                  : item.href === "/messaging"
                    ? readDeveloperDocsHref("business-messaging")
                    : item.href;
                const current = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link href={href} className={styles.navigationLink} aria-current={current ? "page" : undefined} onClick={onNavigate}>
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
