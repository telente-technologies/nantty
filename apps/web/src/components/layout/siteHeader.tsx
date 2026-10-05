"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ThemeSwitcher } from "@zudomart/web-kit";

import { businessAppLinks, siteConfig } from "@/lib/siteConfig.config";

import { ForBusinessDisclosureMenu } from "./forBusinessMenu";
import styles from "./siteHeader.module.css";
import { ZudomartWordmarkHomeLink } from "./zudomartWordmark";

export function SiteHeaderWithFloatingNavigation() {
  const currentPathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [hasScrolledPastTop, setHasScrolledPastTop] = useState(false);
  const menuToggleButtonRef = useRef<HTMLButtonElement>(null);
  const firstMobileMenuLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    function updateScrolledStateFromWindowPosition() {
      setHasScrolledPastTop(window.scrollY > 24);
    }
    updateScrolledStateFromWindowPosition();
    window.addEventListener("scroll", updateScrolledStateFromWindowPosition, { passive: true });
    return () => window.removeEventListener("scroll", updateScrolledStateFromWindowPosition);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [currentPathname]);

  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    firstMobileMenuLinkRef.current?.focus();
    function closeMobileMenuOnEscapeKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setIsMobileMenuOpen(false);
      menuToggleButtonRef.current?.focus();
    }
    document.addEventListener("keydown", closeMobileMenuOnEscapeKey);
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.removeEventListener("keydown", closeMobileMenuOnEscapeKey);
    };
  }, [isMobileMenuOpen]);

  function isNavigationLinkForCurrentPage(linkHref: string): boolean {
    return !linkHref.includes("#") && currentPathname === linkHref;
  }

  return (
    <header className={`${styles.header} ${hasScrolledPastTop ? styles.scrolled : ""}`}>
      <div className={styles.pill}>
        <ZudomartWordmarkHomeLink collapseOnSmallScreens />
        <nav aria-label="Main" className={styles.desktopNavigation}>
          <ul className={styles.navigationList}>
            {siteConfig.primaryNavigation.map((navigationLink) => (
              <li key={navigationLink.href}>
                <Link href={navigationLink.href} className={styles.navigationLink} aria-current={isNavigationLinkForCurrentPage(navigationLink.href) ? "page" : undefined}>
                  {navigationLink.label}
                </Link>
              </li>
            ))}
            <li>
              <ForBusinessDisclosureMenu />
            </li>
          </ul>
        </nav>
        <ThemeSwitcher iconOnly label="Colour theme" className={styles.themeSwitcher} />
        <Link href="/#download" className={styles.downloadButton}>
          Get the app
        </Link>
        <button
          ref={menuToggleButtonRef}
          type="button"
          className={styles.menuToggleButton}
          aria-expanded={isMobileMenuOpen}
          aria-controls="mobile-navigation"
          onClick={() => setIsMobileMenuOpen((wasOpen) => !wasOpen)}
        >
          <span className="visuallyHidden">{isMobileMenuOpen ? "Close menu" : "Open menu"}</span>
          <span className={styles.menuToggleBars} aria-hidden="true" />
        </button>
      </div>
      <div id="mobile-navigation" className={styles.mobileMenu} hidden={!isMobileMenuOpen}>
        <nav aria-label="Mobile">
          <ul className={styles.mobileNavigationList}>
            {siteConfig.primaryNavigation.map((navigationLink, linkIndex) => (
              <li key={navigationLink.href}>
                <Link
                  ref={linkIndex === 0 ? firstMobileMenuLinkRef : undefined}
                  href={navigationLink.href}
                  className={styles.mobileNavigationLink}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {navigationLink.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/contact" className={styles.mobileNavigationLink} onClick={() => setIsMobileMenuOpen(false)}>
                Contact
              </Link>
            </li>
          </ul>
          <p className={styles.mobileBusinessHeading}>For business</p>
          <ul className={styles.mobileBusinessList}>
            <li>
              <Link href="/sellers" className={styles.mobileBusinessLink} onClick={() => setIsMobileMenuOpen(false)}>
                Sell on Zudomart
              </Link>
            </li>
            {[businessAppLinks.sellerDashboard, businessAppLinks.adsManager].map((businessAppLink) => (
              <li key={businessAppLink.href}>
                <a href={businessAppLink.href} className={styles.mobileBusinessLink} target="_blank" rel="noopener noreferrer">
                  {businessAppLink.label}{"\u00a0↗"}<span className="visuallyHidden"> (opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <Link href="/#download" className={styles.mobileDownloadButton} onClick={() => setIsMobileMenuOpen(false)}>
          Get the app
        </Link>
      </div>
    </header>
  );
}
