"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import { NanttyWordmark, ThemeSwitcher } from "@nantty/web-kit";

import { developerNavigationGroups } from "@/config/sections.config";
import { readDeveloperDocsHref, readDeveloperSupportUrl, readNanttyWebUrl } from "@/config/site.config";

import { DeveloperContextProvider, useDeveloperContext } from "./developerContextProvider";
import { PortalNavigation } from "./portalNavigation";
import { PortalSwitcher } from "./portalSwitcher";
import styles from "./portalShell.module.css";

export function PortalShell({ children, homeHref = "/dashboard" }: { readonly children: ReactNode; readonly homeHref?: string }) {
  return (
    <DeveloperContextProvider>
      <PortalShellFrame homeHref={homeHref}>{children}</PortalShellFrame>
    </DeveloperContextProvider>
  );
}

function PortalShellFrame({ children, homeHref }: { readonly children: ReactNode; readonly homeHref: string }) {
  const { environment, setEnvironment, organizations, organizationId, setOrganizationId, session } = useDeveloperContext();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuToggleRef = useRef<HTMLButtonElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    mobileMenuRef.current?.querySelector<HTMLElement>("a")?.focus();
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setMobileMenuOpen(false);
      menuToggleRef.current?.focus();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileMenuOpen]);

  return (
    <div className={`${styles.shell} nanttyPortalTheme`}>
      <a href="#main-content" className={styles.skipLink}>Skip to content</a>
      <header className={styles.topbar}>
        <div className={styles.headerPill}>
          <div className={styles.topbarBrand}>
            <Link href={homeHref} className={styles.brand} aria-label="Nantty Developer Portal home">
              <NanttyWordmark height={22} />
              <span className={styles.productLabel}>Developers</span>
            </Link>
            {organizations.length > 0 ? (
              <label className={styles.orgSelectWrap}>
                <span className={styles.srOnly}>Organization</span>
                <select aria-label="Active organization" className={styles.orgSelect} value={organizationId} onChange={(e) => setOrganizationId(e.target.value)}>
                  {organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
                </select>
              </label>
            ) : null}
          </div>
          <div className={styles.topbarLeading}>
            <div className={styles.envSwitch} role="group" aria-label="API environment">
              <button
                type="button"
                className={environment === "sandbox" ? styles.envActive : styles.envButton}
                aria-pressed={environment === "sandbox"}
                onClick={() => setEnvironment("sandbox")}
              >
                Sandbox
              </button>
              <button
                type="button"
                className={environment === "production" ? styles.envActiveProd : styles.envButton}
                aria-pressed={environment === "production"}
                onClick={() => setEnvironment("production")}
              >
                Production
              </button>
            </div>
            <div className={styles.topbarActions}>
              {session.authenticated ? (
                <form action="/api/auth/logout" method="post">
                  <button type="submit" className={styles.authAction}>Sign out</button>
                </form>
              ) : (
                <Link href="/login" className={styles.authAction}>Sign in / OTP</Link>
              )}
              <a className={styles.publicSiteLink} href={readNanttyWebUrl()}>Nantty.com <span aria-hidden="true">↗</span></a>
              <ThemeSwitcher iconOnly label="Colour theme" className={styles.desktopThemeSwitcher} />
              <button ref={menuToggleRef} type="button" className={styles.menuToggleButton} aria-expanded={mobileMenuOpen} aria-controls="developer-mobile-navigation" onClick={() => setMobileMenuOpen((open) => !open)}>
                <span className={styles.srOnly}>{mobileMenuOpen ? "Close menu" : "Open menu"}</span><span className={styles.menuToggleBars} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </header>
      <div ref={mobileMenuRef} id="developer-mobile-navigation" className={styles.mobileMenu} hidden={!mobileMenuOpen}>
        <PortalNavigation groups={developerNavigationGroups} homeHref={homeHref} onNavigate={() => setMobileMenuOpen(false)} />
        <PortalSwitcher onNavigate={() => setMobileMenuOpen(false)} />
        <div className={styles.mobileMenuBottom}>
          <ThemeSwitcher label="Appearance" showLabel />
          <nav aria-label="Developer help and legal"><a href={readDeveloperSupportUrl()}>Contact support</a><a href={new URL("/terms", readNanttyWebUrl()).toString()}>Terms</a><a href={new URL("/privacy", readNanttyWebUrl()).toString()}>Privacy</a></nav>
        </div>
      </div>
      <aside className={styles.sidebar}>
        <PortalNavigation groups={developerNavigationGroups} homeHref={homeHref} />
        <PortalSwitcher />
        <p className={styles.sidebarNote}>Business access is scoped, approved, and audited.</p>
      </aside>
      <main id="main-content" className={styles.main} tabIndex={-1}>
        {children}
      </main>
      <footer className={`${styles.footer} nanttyPortalFooter`}>
        <div className={styles.footerInner}>
          <div className={styles.footerTop}>
            <div className={styles.footerBrand}>
              <Link href={homeHref} aria-label="Nantty Developers home"><NanttyWordmark height={24} tone="onDark" /></Link>
              <p>Tools and documentation for building with Nantty.</p>
            </div>
            <div className={styles.footerNavigation}>
              <nav className={styles.footerGroup} aria-label="Build with Nantty">
                <h2>Build</h2><ul><li><Link href="/applications">Applications</Link></li><li><Link href="/credentials">API credentials</Link></li><li><Link href={readDeveloperDocsHref()}>Documentation</Link></li></ul>
              </nav>
              <nav className={styles.footerGroup} aria-label="Operate Nantty integrations">
                <h2>Operate</h2><ul><li><Link href="/webhooks">Webhooks</Link></li><li><Link href="/requests">Request logs</Link></li><li><Link href="/usage">Usage and billing</Link></li></ul>
              </nav>
              <nav className={styles.footerGroup} aria-label="Nantty links">
                <h2>Nantty</h2><ul><li><a href={readDeveloperSupportUrl()}>Contact support</a></li><li><a href={new URL("/terms", readNanttyWebUrl()).toString()}>Terms</a></li><li><a href={new URL("/privacy", readNanttyWebUrl()).toString()}>Privacy</a></li><li><a href={new URL("/cookies", readNanttyWebUrl()).toString()}>Cookies</a></li></ul>
              </nav>
            </div>
          </div>
          <div className={styles.footerBottom}><p>© {new Date().getFullYear()} Nantty.</p><p>When reporting an issue, include the environment and request ID. Never send credentials or customer data.</p></div>
          <p className={`${styles.footerWordmark} nanttyPortalFooterWordmark`} aria-hidden="true">Nantty</p>
        </div>
      </footer>
    </div>
  );
}
