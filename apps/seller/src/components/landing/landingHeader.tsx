"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { DashboardWordmark } from "@/components/layout/sidebarNavigation";
import { landingNavigationLinks } from "@/constants/landingContent.constant";

import styles from "./landingHeader.module.css";
import { PrelaunchLoginAction } from "./prelaunchLoginAction";

export function LandingHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);

  useEffect(() => {
    function updateScrolledState() {
      setHasScrolled(window.scrollY > 24);
    }
    updateScrolledState();
    window.addEventListener("scroll", updateScrolledState, { passive: true });
    return () => window.removeEventListener("scroll", updateScrolledState);
  }, []);

  useEffect(() => {
    if (!isMenuOpen) return;
    function closeMenuOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsMenuOpen(false);
    }
    document.addEventListener("keydown", closeMenuOnEscape);
    return () => document.removeEventListener("keydown", closeMenuOnEscape);
  }, [isMenuOpen]);

  return (
    <header className={`${styles.header} ${hasScrolled ? styles.scrolled : ""}`}>
      <div className={styles.pill}>
        <Link href="/" className={styles.brand} aria-label="Nantty Dashboard home">
          <DashboardWordmark withSymbol />
        </Link>
        <nav aria-label="Main" className={styles.desktopNavigation}>
          <ul>
            {landingNavigationLinks.map((link) => (
              <li key={link.href}>
                <a href={link.href} className={styles.navigationLink}>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <PrelaunchLoginAction className={styles.signInButton}>
          Sign in
        </PrelaunchLoginAction>
        <button type="button" className={styles.menuButton} aria-expanded={isMenuOpen} aria-controls="landing-mobile-menu" onClick={() => setIsMenuOpen((wasOpen) => !wasOpen)}>
          <span className="visuallyHidden">{isMenuOpen ? "Close menu" : "Open menu"}</span>
          <span className={styles.menuBars} aria-hidden="true" />
        </button>
      </div>
      <div id="landing-mobile-menu" className={styles.mobileMenu} hidden={!isMenuOpen}>
        <nav aria-label="Mobile">
          <ul>
            {landingNavigationLinks.map((link) => (
              <li key={link.href}>
                <a href={link.href} className={styles.mobileLink} onClick={() => setIsMenuOpen(false)}>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <PrelaunchLoginAction className={styles.mobileSignIn}>
          Sign in with your Nantty account
        </PrelaunchLoginAction>
      </div>
    </header>
  );
}
