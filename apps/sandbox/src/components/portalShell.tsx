import Link from "next/link";
import type { ReactNode } from "react";

import { nanttySymbolPath, ThemeSwitcher } from "@nantty/web-kit";

import { sandboxSections } from "@/config/sections.config";

import { PortalNavigation } from "./portalNavigation";
import styles from "./portalShell.module.css";

export function PortalShell({ children }: { readonly children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <a href="#main-content" className={styles.skipLink}>Skip to content</a>
      <aside className={styles.sidebar}>
        <Link href="/" className={styles.brand} aria-label="Nantty Sandbox home">
          <span className={styles.brandMark} aria-hidden="true"><svg viewBox="0 0 1024 1024" focusable="false"><rect width="1024" height="1024" rx="229" /><path d={nanttySymbolPath()} /></svg></span>
          <span className={styles.brandName}>Nantty</span>
          <span className={styles.productLabel}>Sandbox</span>
        </Link>
        <PortalNavigation items={sandboxSections} />
        <p className={styles.sidebarNote}>Synthetic data only. Never use production credentials here.</p>
      </aside>
      <header className={styles.topbar}>
        <span className={styles.topbarProduct}>Nantty API Sandbox</span>
        <div className={styles.topbarActions}>
          <ThemeSwitcher iconOnly label="Colour theme" />
          <span className={styles.environment}>TEST ENVIRONMENT</span>
        </div>
      </header>
      <main id="main-content" className={styles.main} tabIndex={-1}>
        <div className={styles.notice} role="status">
          <strong>Sandbox-only surface · currently disconnected</strong>
          <span>No real Nantty users, businesses, messages, or production APIs are reachable from this app.</span>
        </div>
        {children}
      </main>
    </div>
  );
}
