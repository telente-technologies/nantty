"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import styles from "@/components/settings/settings.module.css";
import { HelpIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/studioPage";
import { webappLinks } from "@/config/webappLinks.config";

const TABS = [
  { href: "/settings", label: "General" },
  { href: "/settings/live", label: "Live defaults" },
  { href: "/settings/embed", label: "Embed" },
  { href: "/settings/account", label: "Account" },
] as const;

export default function SettingsLayout({ children }: { readonly children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className={styles.page}>
      <PageHeader title="Settings" subtitle="Notifications, privacy, defaults for your lives, website embeds and your account." />
      <nav aria-label="Settings sections" className={styles.nav}>
        <ul className={styles.tabs}>
          {TABS.map((tab) => (
            <li key={tab.href}>
              <Link href={tab.href} className={styles.tab} aria-current={pathname === tab.href ? "page" : undefined}>{tab.label}</Link>
            </li>
          ))}
        </ul>
        <a href={webappLinks.help} className={styles.helpLink} target="_blank" rel="noopener noreferrer">
          <HelpIcon size={16} />
          Help Centre
          <span className="visuallyHidden"> (opens in a new tab)</span>
        </a>
      </nav>
      {children}
    </div>
  );
}
