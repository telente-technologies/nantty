"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import { NanttyWordmark, ThemeSwitcher } from "@nantty/web-kit";

import { sandboxNavigationGroups } from "@/config/sections.config";
import { readDeveloperPortalUrl, readNanttyWebUrl, readSandboxSupportUrl } from "@/config/site.config";

import { PortalNavigation } from "./portalNavigation";
import { PortalSwitcher } from "./portalSwitcher";
import styles from "./portalShell.module.css";

export function PortalShell({ children }: { readonly children: ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuToggleRef = useRef<HTMLButtonElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    mobileMenuRef.current?.querySelector<HTMLElement>("a")?.focus();

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setMobileMenuOpen(false);
      menuToggleRef.current?.focus();
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileMenuOpen]);

  const currentYear = new Date().getFullYear();

  return (
    <div className={`${styles.shell} nanttyPortalTheme`}>
      <a href="#main-content" className={styles.skipLink}>Skip to content</a>
      <header className={styles.topbar}>
        <div className={styles.headerPill}>
          <div className={styles.topbarBrand}>
            <Link href="/" className={styles.brand} aria-label="Nantty Sandbox home">
              <NanttyWordmark height={22} />
              <span className={styles.productLabel}>Sandbox</span>
            </Link>
            <PortalSwitcher />
          </div>
          <div className={styles.topbarLeading}>
            <span className={styles.environment}>Test environment · isolated</span>
            <div className={styles.topbarActions}>
              <a className={styles.publicSiteLink} href={readNanttyWebUrl()}>Nantty.com <span aria-hidden="true">↗</span></a>
              <ThemeSwitcher iconOnly label="Colour theme" className={styles.desktopThemeSwitcher} />
              <button
                ref={menuToggleRef}
                type="button"
                className={styles.menuToggleButton}
                aria-expanded={mobileMenuOpen}
                aria-controls="sandbox-mobile-navigation"
                onClick={() => setMobileMenuOpen((isOpen) => !isOpen)}
              >
                <span className={styles.srOnly}>{mobileMenuOpen ? "Close menu" : "Open menu"}</span>
                <span className={styles.menuToggleBars} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </header>
      <div ref={mobileMenuRef} id="sandbox-mobile-navigation" className={styles.mobileMenu} hidden={!mobileMenuOpen}>
        <div className={styles.mobileMenuContent}>
          <PortalNavigation groups={sandboxNavigationGroups} mobile onNavigate={() => setMobileMenuOpen(false)} />
          <p className={styles.mobileSafetyNote}>Synthetic data only. Never use production credentials here.</p>
          <ThemeSwitcher label="Appearance" showLabel className={styles.mobileThemeSwitcher} />
        </div>
        <nav className={styles.mobileLegal} aria-label="Nantty links">
          <a href={readSandboxSupportUrl()}>Contact support</a>
          <a href={new URL("/terms", readNanttyWebUrl()).toString()}>Terms</a>
          <a href={new URL("/privacy", readNanttyWebUrl()).toString()}>Privacy</a>
        </nav>
      </div>
      <aside className={styles.sidebar}>
        <PortalNavigation groups={sandboxNavigationGroups} />
        <p className={styles.sidebarNote}>Synthetic data only. Never use production credentials here.</p>
      </aside>

      <main id="main-content" className={styles.main} tabIndex={-1}>
        <div className={styles.notice} role="status">
          <strong>Sandbox service not connected</strong>
          <span>Only a separately deployed service with synthetic tenants may be connected. Production credentials and customer data are never accepted.</span>
        </div>
        {children}
      </main>
      <footer className={`${styles.footer} nanttyPortalFooter`}>
        <div className={styles.footerInner}>
          <div className={styles.footerTop}>
            <div className={styles.footerBrand}>
              <Link href="/" aria-label="Nantty Sandbox home"><NanttyWordmark height={24} tone="onDark" /></Link>
              <p>Isolated integration testing for Nantty APIs. Service connections and test credentials are not available in this deployment.</p>
              <a href={readSandboxSupportUrl()}>Contact Nantty support</a>
            </div>
            <div className={styles.footerNavigation}>
              <nav className={styles.footerGroup} aria-label="Sandbox navigation">
                <h2>Test</h2>
                <ul>
                  <li><Link href="/test-apps">Test applications</Link></li>
                  <li><Link href="/explorer">API explorer</Link></li>
                  <li><Link href="/messaging">Messaging scenarios</Link></li>
                  <li><Link href="/docs">Sandbox guide</Link></li>
                </ul>
              </nav>
              <nav className={styles.footerGroup} aria-label="Developer resources">
                <h2>Inspect</h2>
                <ul>
                  <li><Link href="/events">Webhook events</Link></li>
                  <li><Link href="/requests">Request log</Link></li>
                  <li><Link href="/docs">Sandbox guide</Link></li>
                </ul>
              </nav>
              <nav className={styles.footerGroup} aria-label="Nantty policies">
                <h2>Nantty</h2>
                <ul>
                  <li><a href={new URL("/terms", readNanttyWebUrl()).toString()}>Terms</a></li>
                  <li><a href={new URL("/privacy", readNanttyWebUrl()).toString()}>Privacy</a></li>
                  <li><a href={new URL("/cookies", readNanttyWebUrl()).toString()}>Cookies</a></li>
                  <li><a href={readDeveloperPortalUrl()}>Developer platform</a></li>
                </ul>
              </nav>
            </div>
          </div>
          <div className={styles.footerBottom}>
            <p>© {currentYear} Nantty. Sandbox environment.</p>
            <p>Share request and event IDs with support—never credentials.</p>
          </div>
          <p className={`${styles.footerWordmark} nanttyPortalFooterWordmark`} aria-hidden="true">Nantty</p>
        </div>
      </footer>
    </div>
  );
}
