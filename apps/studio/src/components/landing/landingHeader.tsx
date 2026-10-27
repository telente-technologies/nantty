"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { ThemeAwareNanttyWordmark, ThemeSwitcher } from "@nantty/web-kit";

import { landingNavigationLinks } from "./landingContent.constant";
import { PrelaunchLoginAction } from "./prelaunchLoginAction";
import styles from "./landingHeader.module.css";

export function LandingHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

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
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function closeMenuOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setIsMenuOpen(false);
      menuButtonRef.current?.focus();
    }
    document.addEventListener("keydown", closeMenuOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeMenuOnEscape);
    };
  }, [isMenuOpen]);

  return (
    <header className={`${styles.header} ${hasScrolled ? styles.scrolled : ""}`}>
      <div className={styles.pill}>
        <Link href="/" className={styles.brand} aria-label="Nantty Studio home">
          <ThemeAwareNanttyWordmark productLabel="Studio" height={30} collapseToMarkOnSmallScreens />
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
        <ThemeSwitcher iconOnly label="Colour theme" className={styles.themeSwitcher} />
        <PrelaunchLoginAction className={styles.signInButton}>
          Sign in
        </PrelaunchLoginAction>
        <button ref={menuButtonRef} type="button" className={styles.menuButton} aria-expanded={isMenuOpen} aria-controls="landing-mobile-menu" onClick={() => setIsMenuOpen((wasOpen) => !wasOpen)}>
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
        <ThemeSwitcher label="Colour theme" showLabel className={styles.mobileThemeSwitcher} />
        <PrelaunchLoginAction className={styles.mobileSignIn}>
          Sign in with your Nantty account
        </PrelaunchLoginAction>
      </div>
    </header>
  );
}
