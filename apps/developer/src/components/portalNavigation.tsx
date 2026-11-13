"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ActivityIcon, CodeIcon, HelpIcon, LockIcon, ShareIcon, WalletIcon, type IconProps } from "@/components/ui/icons";
import type { ComponentType } from "react";

import styles from "./portalShell.module.css";

export interface PortalNavigationItem {
  readonly href: string;
  readonly label: string;
  readonly icon: "activity" | "code" | "help" | "lock" | "share" | "wallet";
}

const icons: Record<PortalNavigationItem["icon"], ComponentType<IconProps>> = {
  activity: ActivityIcon,
  code: CodeIcon,
  help: HelpIcon,
  lock: LockIcon,
  share: ShareIcon,
  wallet: WalletIcon,
};

export function PortalNavigation({ items }: { readonly items: readonly PortalNavigationItem[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Developer portal" className={styles.navigation}>
      <ul className={styles.navigationList}>
        <li>
          <Link href="/" className={styles.navigationLink} aria-current={pathname === "/" ? "page" : undefined}>
            <CodeIcon size={19} />
            <span>Overview</span>
          </Link>
        </li>
        {items.map((item) => {
          const Icon = icons[item.icon];
          const current = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link href={item.href} className={styles.navigationLink} aria-current={current ? "page" : undefined}>
                <Icon size={19} />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
