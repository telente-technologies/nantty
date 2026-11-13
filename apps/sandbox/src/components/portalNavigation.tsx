"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";

import { ActivityIcon, ClockIcon, CodeIcon, HelpIcon, PlayIcon, ShareIcon, type IconProps } from "@/components/ui/icons";

import styles from "./portalShell.module.css";

export interface PortalNavigationItem {
  readonly href: string;
  readonly label: string;
  readonly icon: "activity" | "clock" | "code" | "help" | "play" | "share";
}

const icons: Record<PortalNavigationItem["icon"], ComponentType<IconProps>> = {
  activity: ActivityIcon,
  clock: ClockIcon,
  code: CodeIcon,
  help: HelpIcon,
  play: PlayIcon,
  share: ShareIcon,
};

export function PortalNavigation({ items }: { readonly items: readonly PortalNavigationItem[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Sandbox sections" className={styles.navigation}>
      <ul className={styles.navigationList}>
        <li>
          <Link href="/" className={styles.navigationLink} aria-current={pathname === "/" ? "page" : undefined}>
            <CodeIcon size={19} /><span>Overview</span>
          </Link>
        </li>
        {items.map((item) => {
          const Icon = icons[item.icon];
          const current = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return <li key={item.href}><Link href={item.href} className={styles.navigationLink} aria-current={current ? "page" : undefined}><Icon size={19} /><span>{item.label}</span></Link></li>;
        })}
      </ul>
    </nav>
  );
}
