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
          <Link href="/products">Products</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href={readDeveloperDocsHref()}>Docs</Link>
          <Link href={readDeveloperDocsHref("business-messaging")}>Messaging API</Link>
          <Link href="/changelog">Changelog</Link>
          <Link href="/dashboard">Console</Link>
        </nav>
        <ThemeSwitcher iconOnly label="Colour theme" />
        <details className={styles.mobileNav}>
          <summary><span className={styles.srOnly}>Open documentation navigation</span><span aria-hidden="true">Menu</span></summary>
          <nav aria-label="Documentation">
            <Link href="/products">Products</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href={readDeveloperDocsHref()}>Docs</Link>
            <Link href={readDeveloperDocsHref("business-messaging")}>Messaging API</Link>
            <Link href="/changelog">Changelog</Link>
            <Link href="/dashboard">Console</Link>
          </nav>
        </details>
      </header>
      <main id="main-content" className={styles.main} tabIndex={-1}>{children}</main>
      <footer className={`${styles.footer} nanttyPortalFooter`}>
        <div className={styles.footerMain}>
          <div className={styles.footerBrand}><NanttyWordmark height={24} tone="onDark" /><p>Public API documentation and OpenAPI 3.1 contract reference for Nantty integrations.</p></div>
          <nav className={styles.footerGroups} aria-label="Documentation footer">
            <div><h2>Documentation</h2><Link href={readDeveloperDocsHref("quickstart")}>Quickstart</Link><Link href={readDeveloperDocsHref("api-reference")}>API reference</Link><Link href={readDeveloperDocsHref("webhooks")}>Webhooks</Link><Link href={readDeveloperDocsHref("errors")}>Errors</Link></div>
            <div><h2>Platform</h2><Link href="/pricing">Pricing &amp; quotas</Link><Link href="/security">Security</Link><Link href="/legal/developer-terms">Developer terms</Link><Link href="/legal/acceptable-use">Acceptable use</Link></div>
            <div><h2>Nantty</h2><a href={readDeveloperSupportUrl()}>Developer support</a><a href={new URL("/terms", readNanttyWebUrl()).toString()}>Terms</a><a href={new URL("/privacy", readNanttyWebUrl()).toString()}>Privacy</a><a href={readNanttyWebUrl()}>Nantty home</a></div>
          </nav>
        </div>
        <div className={styles.footerBottom}><span>© {new Date().getFullYear()} Nantty</span><span>Sandbox testing active · Production routes require approved applications</span></div>
        <p className={`${styles.footerWordmark} nanttyPortalFooterWordmark`} aria-hidden="true">Nantty</p>
      </footer>
    </div>
  );
}
