import Link from "next/link";

import { ThemeAwareNanttyWordmark, ThemeSwitcher } from "@nantty/web-kit";
import { landingNavigationLinks } from "@/constants/landingContent.constant";

import styles from "./landingHeader.module.css";
import { PrelaunchLoginAction } from "./prelaunchLoginAction";

export function LandingHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.pill}>
        <Link href="/" className={styles.brand} aria-label="Nantty Dashboard home">
          <ThemeAwareNanttyWordmark productLabel="Dashboard" height={30} collapseToMarkOnSmallScreens />
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
        <ThemeSwitcher iconOnly label="Colour theme" className={styles.desktopThemeSwitcher} />
        <PrelaunchLoginAction className={styles.signInButton}>
          Sign in
        </PrelaunchLoginAction>
        <details className={styles.mobileMenu}>
          <summary aria-label="Open navigation"><span className="visuallyHidden">Open navigation</span><span className={styles.menuBars} aria-hidden="true" /></summary>
          <div className={styles.mobileMenuPanel}>
            <nav aria-label="Mobile">
              <ul>
                {landingNavigationLinks.map((link) => (
                  <li key={link.href}><a href={link.href} className={styles.mobileLink}>{link.label}</a></li>
                ))}
              </ul>
            </nav>
            <div className={styles.mobileMenuBottom}>
              <ThemeSwitcher label="Colour theme" showLabel className={styles.mobileThemeSwitcher} />
              <PrelaunchLoginAction className={styles.mobileSignIn}>Sign in with your Nantty account</PrelaunchLoginAction>
            </div>
          </div>
        </details>
      </div>
    </header>
  );
}
