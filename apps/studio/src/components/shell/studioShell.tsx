"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";

import { ConnectionStatus, ZudomartWordmark } from "@zudomart/web-kit";

import { AccountMenu } from "@/components/shell/accountMenu";
import { NotificationsLink } from "@/components/shell/notificationsLink";
import { CreatorProgramGate } from "@/components/shell/creatorProgramGate";
import { useSession } from "@/components/providers/sessionProvider";
import { webappLinks } from "@/config/webappLinks.config";
import {
  AnalyticsIcon, CloseIcon, CommentsIcon, ContentIcon, HelpIcon, HomeIcon, LiveIcon, MenuIcon, SettingsIcon, SubscribersIcon, TagIcon, WalletIcon, type IconProps,
} from "@/components/ui/icons";

import styles from "./studioShell.module.css";

interface SectionLink {
  readonly href: string;
  readonly label: string;
  readonly icon: ComponentType<IconProps>;
  readonly matches?: readonly string[];
}

export const studioSections: readonly SectionLink[] = [
  { href: "/home", label: "Home", icon: HomeIcon },
  { href: "/lives", label: "Go live", icon: LiveIcon },
  { href: "/content", label: "Content", icon: ContentIcon },
  { href: "/analytics", label: "Analytics", icon: AnalyticsIcon, matches: ["/audience"] },
  { href: "/comments", label: "Comments", icon: CommentsIcon },
  { href: "/earnings", label: "Earnings", icon: WalletIcon },
  { href: "/affiliates", label: "Affiliate", icon: TagIcon },
  { href: "/subscribers", label: "Subscribers", icon: SubscribersIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon, matches: ["/account", "/embed"] },
];

export const isSectionCurrent = (pathname: string, section: SectionLink) =>
  [section.href, ...(section.matches ?? [])].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

export function StudioShell({ children }: { readonly children: ReactNode }) {
  const { viewer } = useSession();
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  const showSections = !(viewer !== null && !viewer.isCreator);

  useEffect(() => setNavOpen(false), [pathname]);

  useEffect(() => {
    if (!navOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNavOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [navOpen]);

  return (
    <div className={styles.shell}>
      <a href="#main-content" className={styles.skipLink}>Skip to content</a>
      <ConnectionStatus />
      <aside className={styles.sidebar} data-open={navOpen ? "true" : undefined}>
        <div className={styles.brandRow}>
          <Link href="/home" className={styles.brand} aria-label="Zudomart Studio home">
            <ZudomartWordmark productLabel="Studio" height={20} withSymbol collapseToMarkOnSmallScreens />
          </Link>
          {showSections ? (
            <button type="button" className={styles.menuButton} aria-expanded={navOpen} aria-controls="studio-navigation" onClick={() => setNavOpen((open) => !open)}>
              {navOpen ? <CloseIcon size={20} /> : <MenuIcon size={20} />}
              <span className="visuallyHidden">{navOpen ? "Close menu" : "Open menu"}</span>
            </button>
          ) : null}
        </div>
        <div className={styles.drawer} id="studio-navigation">
          {showSections ? (
            <nav aria-label="Studio sections" className={styles.nav}>
              <ul className={styles.navList}>
                {studioSections.map((section) => {
                  const Icon = section.icon;
                  const current = isSectionCurrent(pathname, section);
                  return (
                    <li key={section.href}>
                      <Link href={section.href} className={styles.navLink} aria-current={current ? "page" : undefined} title={section.label}>
                        <Icon size={20} weight={current ? "fill" : "regular"} />
                        <span className={styles.navLabel}>{section.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          ) : <span className={styles.navSpacer} />}
          <div className={styles.sidebarFooter}>
            {viewer ? <NotificationsLink /> : null}
            <a href={webappLinks.help} className={styles.navLink} target="_blank" rel="noopener noreferrer" title="Help Centre">
              <HelpIcon size={20} />
              <span className={styles.navLabel}>Help Centre</span>
              <span className="visuallyHidden"> (opens in a new tab)</span>
            </a>
            <AccountMenu />
          </div>
        </div>
      </aside>
      {navOpen ? <button type="button" className={styles.scrim} aria-label="Close menu" tabIndex={-1} onClick={() => setNavOpen(false)} /> : null}
      <main id="main-content" className={styles.main} tabIndex={-1}>
        {showSections ? children : <CreatorProgramGate />}
      </main>
    </div>
  );
}
