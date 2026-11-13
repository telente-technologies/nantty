import Link from "next/link";
import type { ReactNode } from "react";

import { nanttySymbolPath, ThemeSwitcher } from "@nantty/web-kit";

import { developerSections } from "@/config/sections.config";

import { PortalNavigation } from "./portalNavigation";
import styles from "./portalShell.module.css";

export function PortalShell({ children }: { readonly children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <a href="#main-content" className={styles.skipLink}>Skip to content</a>
      <aside className={styles.sidebar}>
        <Link href="/" className={styles.brand} aria-label="Nantty Developer Portal home">
          <span className={styles.brandMark} aria-hidden="true"><svg viewBox="0 0 1024 1024" focusable="false"><rect width="1024" height="1024" rx="229" /><path d={nanttySymbolPath()} /></svg></span>
          <span className={styles.brandName}>Nantty</span>
          <span className={styles.productLabel}>Developers</span>
        </Link>
        <PortalNavigation items={developerSections} />
        <p className={styles.sidebarNote}>Business integrations, with explicit access controls.</p>
      </aside>
      <header className={styles.topbar}>
        <span className={styles.topbarProduct}>Nantty Developer Portal</span>
        <div className={styles.topbarActions}>
          <ThemeSwitcher iconOnly label="Colour theme" />
          <span className={styles.environment}>Preview · no API access</span>
        </div>
      </header>
      <main id="main-content" className={styles.main} tabIndex={-1}>
        <div className={styles.notice} role="status">
          <strong>Management actions are disabled.</strong>
          <span>Centralized sign-in, organization authorization, and the public API service are not connected to this portal.</span>
        </div>
        {children}
      </main>
    </div>
  );
}
