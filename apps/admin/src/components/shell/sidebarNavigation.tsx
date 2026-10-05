"use client";

import Link from "next/link";
import { ZudomartWordmark } from "@zudomart/web-kit";
import { usePathname } from "next/navigation";

import { useAdminSession } from "@/components/session/adminSessionProvider";
import { ZudoIcon } from "@/components/ui/zudoIcon";
import { navigationGroups } from "@/config/navigation.config";
import { doesAdminMeetPageRequirement } from "@/utils/adminAccess.util";

import { EnvironmentBadge } from "./environmentBadge";
import styles from "./sidebarNavigation.module.css";

export function SidebarNavigation({ isOpenOnSmallScreens, onNavigate }: { readonly isOpenOnSmallScreens: boolean; readonly onNavigate: () => void }) {
  const pathname = usePathname();
  const { admin, environment } = useAdminSession();
  const visibleGroups = navigationGroups
    .map((group) => ({ ...group, items: group.items.filter((item) => doesAdminMeetPageRequirement(admin, item.requirement)) }))
    .filter((group) => group.items.length > 0);

  return (
    <aside className={`${styles.sidebar} ${isOpenOnSmallScreens ? styles.open : ""}`} aria-label="Admin sections">
      <div className={styles.brand}>
        <Link href="/" aria-label="Zudomart Admin home">
          <ZudomartWordmark productLabel="Admin" tone="onDark" withSymbol />
        </Link>
        <EnvironmentBadge environment={environment} />
      </div>
      <nav className={styles.navigation}>
        {visibleGroups.map((group) => (
          <div key={group.title} className={styles.group}>
            <p className={styles.groupTitle}>{group.title}</p>
            <ul className={styles.list}>
              {group.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link href={item.href} className={isActive ? `${styles.link} ${styles.active}` : styles.link} aria-current={isActive ? "page" : undefined} onClick={onNavigate}>
                      <ZudoIcon name={item.icon} size={16} />
                      <span className={styles.linkLabel}>{item.label}</span>
                      {item.goShortcutKey ? <span className={styles.shortcut} aria-hidden>g {item.goShortcutKey}</span> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className={styles.footer}>
        <Link href="/account/security" className={styles.account} onClick={onNavigate}>
          <span className={styles.accountName}>{admin.name}</span>
          <span className={styles.accountRole}>{admin.role.toLowerCase()} · security</span>
        </Link>
      </div>
    </aside>
  );
}
