import Link from "next/link";
import type { ReactNode } from "react";
import { NanttyWordmark, ThemeSwitcher } from "@nantty/web-kit";

import { readDeveloperDocsHref, readDeveloperSupportUrl, readNanttyWebUrl, readPublicSiteUrl } from "@/config/site.config";

import styles from "./publicDocsShell.module.css";

export function PublicDocsShell({ children }: { readonly children: ReactNode }) {
  return (
    <div className={`${styles.site} nanttyPortalTheme`}>
      <a className={styles.skipLink} href="#main-content">Skip to documentation</a>
      <header className={styles.header}>
        <Link className={styles.brand} href={readPublicSiteUrl()} aria-label="Nantty Developers home">
          <NanttyWordmark height={25} />
          <span>Developers</span>
        </Link>
        <nav className={styles.nav} aria-label="Documentation">
          <Link href={readDeveloperDocsHref()}>Documentation</Link>
          <Link href={readDeveloperDocsHref("business-messaging")}>Business messaging</Link>
          <a href={readDeveloperSupportUrl()}>Support</a>
        </nav>
        <ThemeSwitcher iconOnly label="Colour theme" />
        <details className={styles.mobileNav}>
          <summary><span className={styles.srOnly}>Open documentation navigation</span><span aria-hidden="true">Menu</span></summary>
          <nav aria-label="Documentation">
            <Link href={readDeveloperDocsHref()}>Documentation</Link>
            <Link href={readDeveloperDocsHref("business-messaging")}>Business messaging</Link>
            <a href={readDeveloperSupportUrl()}>Support</a>
          </nav>
        </details>
      </header>
      <main id="main-content" className={styles.main} tabIndex={-1}>{children}</main>
      <footer className={`${styles.footer} nanttyPortalFooter`}>
        <div className={styles.footerMain}>
          <div className={styles.footerBrand}><NanttyWordmark height={24} tone="onDark" /><p>Public API documentation and contract previews for Nantty integrations.</p></div>
          <nav className={styles.footerGroups} aria-label="Documentation footer">
            <div><h2>Documentation</h2><Link href={readDeveloperDocsHref()}>API overview</Link><Link href={readDeveloperDocsHref("business-messaging")}>Business messaging</Link></div>
            <div><h2>Support</h2><a href={readDeveloperSupportUrl()}>Developer support</a><a href={new URL("/terms", readNanttyWebUrl()).toString()}>Terms</a><a href={new URL("/privacy", readNanttyWebUrl()).toString()}>Privacy</a></div>
            <div><h2>Nantty</h2><a href={new URL("/cookies", readNanttyWebUrl()).toString()}>Cookies</a><a href={readNanttyWebUrl()}>Nantty home</a></div>
          </nav>
        </div>
        <div className={styles.footerBottom}><span>© {new Date().getFullYear()} Nantty</span><span>Contract preview · Requests are disabled</span></div>
        <p className={`${styles.footerWordmark} nanttyPortalFooterWordmark`} aria-hidden="true">Nantty</p>
      </footer>
    </div>
  );
}
