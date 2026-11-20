"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { NanttyWordmark, ThemeSwitcher } from "@nantty/web-kit";

import { ListIcon, XIcon } from "@/components/ui/icons";
import { readDeveloperDocsHref, readDeveloperSupportUrl, readNanttyWebUrl, readSandboxPortalUrl } from "@/config/site.config";

import { apiReferenceEndpoints } from "./apiReferenceData";
import { DocsSearchTrigger } from "./docsSearchModal";
import styles from "./publicDocsShell.module.css";

interface SidebarLinkItem {
  readonly label: string;
  readonly href: string;
  readonly badge?: "POST" | "GET";
  readonly external?: boolean;
}

interface SidebarGroup {
  readonly label: string;
  readonly items: readonly SidebarLinkItem[];
}

export function PublicDocsShell({ children }: { readonly children: ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  const sidebarGroups: readonly SidebarGroup[] = [
    {
      label: "Getting Started",
      items: [
        { label: "Developer Overview", href: "/" },
        { label: "Quickstart", href: readDeveloperDocsHref("quickstart") },
        { label: "Authentication & SSO", href: readDeveloperDocsHref("authentication") },
        { label: "Sign-in & OTP Step-Up", href: "/login" },
        { label: "Sandbox Guide", href: readDeveloperDocsHref("sandbox") },
      ],
    },
    {
      label: "API Reference",
      items: [
        { label: "API Reference Hub", href: readDeveloperDocsHref("api-reference") },
        { label: "Business Messaging", href: readDeveloperDocsHref("business-messaging") },
        ...apiReferenceEndpoints.map((ep) => ({
          label: ep.title,
          href: `${readDeveloperDocsHref("api-reference")}#${ep.id}`,
          badge: ep.method === "GET" ? ("GET" as const) : ("POST" as const),
        })),
        { label: "OpenAPI 3.1 JSON", href: readDeveloperDocsHref("openapi.json") },
      ],
    },
    {
      label: "Guides & Operations",
      items: [
        { label: "Webhooks & Signatures", href: readDeveloperDocsHref("webhooks") },
        { label: "Error Reference", href: readDeveloperDocsHref("errors") },
        { label: "Rate Limits & Quotas", href: readDeveloperDocsHref("rate-limits") },
        { label: "Billing & Plans", href: readDeveloperDocsHref("billing") },
      ],
    },
    {
      label: "Platform & Trust",
      items: [
        { label: "API Products", href: "/products" },
        { label: "Pricing & Quotas", href: "/pricing" },
        { label: "Changelog", href: "/changelog" },
        { label: "Security Architecture", href: "/security" },
        { label: "Developer Support", href: "/support" },
        { label: "Developer Terms", href: "/legal/developer-terms" },
        { label: "Acceptable Use", href: "/legal/acceptable-use" },
      ],
    },
  ];

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen]);

  function isCurrent(href: string): boolean {
    const cleanHref = href.split("#")[0];
    if (cleanHref === "/") return pathname === "/";
    return pathname === cleanHref;
  }

  function renderSidebarContent(onPick?: () => void) {
    return (
      <div className={styles.sidebarInner}>
        {sidebarGroups.map((group) => (
          <section key={group.label} className={styles.sidebarGroup}>
            <h2 className={styles.sidebarGroupTitle}>{group.label}</h2>
            <ul className={styles.sidebarList}>
              {group.items.map((item) => {
                const active = !item.href.includes("#") && isCurrent(item.href);
                return (
                  <li key={`${group.label}-${item.href}`}>
                    <Link
                      href={item.href}
                      className={`${styles.sidebarLink} ${active ? styles.sidebarLinkActive : ""}`}
                      aria-current={active ? "page" : undefined}
                      onClick={onPick}
                    >
                      {item.badge ? (
                        <span className={`${styles.sidebarMethod} ${item.badge === "GET" ? styles.methodGet : styles.methodPost}`}>
                          {item.badge}
                        </span>
                      ) : null}
                      <span className={styles.sidebarLinkLabel}>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        <div className={styles.sidebarFootCard}>
          <strong>Interactive Workspaces</strong>
          <p>Manage organizations, issue <code>ntsb_test_</code> keys, and test webhook deliveries.</p>
          <div className={styles.sidebarFootActions}>
            <Link href="/dashboard" className={styles.sidebarPrimaryBtn} onClick={onPick}>Developer Console</Link>
            <a href={readSandboxPortalUrl()} className={styles.sidebarSecondaryBtn} onClick={onPick}>Open Sandbox ↗</a>
          </div>
        </div>
      </div>
    );
  }

  const docsHref = readDeveloperDocsHref();
  const apiRefHref = readDeveloperDocsHref("api-reference");

  return (
    <div className={`${styles.shell} nanttyPortalTheme`}>
      <a className={styles.skipLink} href="#main-content">Skip to documentation</a>

      <header className={styles.topbar}>
        <div className={styles.topbarInner}>
          <div className={styles.topbarLeft}>
            <button
              type="button"
              className={styles.drawerToggle}
              aria-expanded={mobileOpen}
              aria-controls="docs-mobile-drawer"
              onClick={() => setMobileOpen((prev) => !prev)}
            >
              {mobileOpen ? <XIcon size={18} /> : <ListIcon size={18} />}
              <span className={styles.srOnly}>Toggle navigation sidebar</span>
            </button>
            <Link className={styles.brand} href="/" aria-label="Nantty Developers home">
              <NanttyWordmark height={23} />
              <span className={styles.brandProduct}>Developers</span>
            </Link>
            <nav className={styles.topTabs} aria-label="Primary sections">
              <Link href={docsHref} className={pathname === "/docs" || pathname === "/docs/quickstart" ? styles.topTabActive : undefined}>Documentation</Link>
              <Link href={apiRefHref} className={pathname === "/docs/api-reference" || pathname === "/docs/business-messaging" ? styles.topTabActive : undefined}>API Reference</Link>
              <Link href="/products" className={pathname.startsWith("/products") ? styles.topTabActive : undefined}>Products</Link>
              <Link href="/dashboard">Console</Link>
              <a href={readSandboxPortalUrl()}>Sandbox <span aria-hidden="true">↗</span></a>
            </nav>
          </div>

          <div className={styles.topbarRight}>
            <DocsSearchTrigger />
            <span className={styles.versionBadge}>v1 · 2026-11</span>
            <ThemeSwitcher iconOnly label="Colour theme" />
            <Link href="/login" className={styles.signInBtn}>Sign in</Link>
          </div>
        </div>
      </header>

      <aside className={styles.sidebar} aria-label="Documentation sidebar">
        {renderSidebarContent()}
      </aside>

      {mobileOpen ? (
        <div className={styles.mobileBackdrop} role="presentation" onClick={() => setMobileOpen(false)}>
          <div
            ref={drawerRef}
            id="docs-mobile-drawer"
            className={styles.mobileDrawer}
            role="dialog"
            aria-modal="true"
            aria-label="Documentation navigation"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.mobileDrawerHead}>
              <NanttyWordmark height={20} />
              <button type="button" className={styles.drawerToggle} onClick={() => setMobileOpen(false)} aria-label="Close navigation">
                <XIcon size={18} />
              </button>
            </div>
            {renderSidebarContent(() => setMobileOpen(false))}
          </div>
        </div>
      ) : null}

      <main id="main-content" className={styles.main} tabIndex={-1}>
        <div className={styles.mainContainer}>{children}</div>
      </main>

      <footer className={`${styles.footer} nanttyPortalFooter`}>
        <div className={styles.footerMain}>
          <div className={styles.footerBrand}>
            <NanttyWordmark height={24} tone="onDark" />
            <p>API documentation, OpenAPI 3.1 reference, and isolated Sandbox tooling for Nantty business integrations.</p>
          </div>
          <nav className={styles.footerGroups} aria-label="Documentation footer">
            <div>
              <h2>Documentation</h2>
              <Link href={readDeveloperDocsHref("quickstart")}>Quickstart</Link>
              <Link href={readDeveloperDocsHref("api-reference")}>API Reference</Link>
              <Link href={readDeveloperDocsHref("webhooks")}>Webhooks</Link>
              <Link href={readDeveloperDocsHref("errors")}>Errors</Link>
            </div>
            <div>
              <h2>Platform</h2>
              <Link href="/dashboard">Developer Console</Link>
              <Link href="/login">Sign-in &amp; OTP</Link>
              <Link href="/pricing">Pricing &amp; Quotas</Link>
              <Link href="/security">Security</Link>
            </div>
            <div>
              <h2>Nantty</h2>
              <a href={readSandboxPortalUrl()}>Sandbox Console</a>
              <a href={readDeveloperSupportUrl()}>Developer Support</a>
              <a href={new URL("/terms", readNanttyWebUrl()).toString()}>Terms</a>
              <a href={new URL("/privacy", readNanttyWebUrl()).toString()}>Privacy</a>
            </div>
          </nav>
        </div>
        <div className={styles.footerBottom}>
          <span>© {new Date().getFullYear()} Nantty</span>
          <span>Sandbox testing active · Production routes require approved applications</span>
        </div>
        <p className={`${styles.footerWordmark} nanttyPortalFooterWordmark`} aria-hidden="true">Nantty</p>
      </footer>
    </div>
  );
}
