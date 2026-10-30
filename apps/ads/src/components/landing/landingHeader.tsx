import Link from "next/link";

import { ThemeAwareNanttyWordmark, ThemeSwitcher } from "@nantty/web-kit";

import { LandingActionLink, type LandingAction } from "./landingPrimitives";
import styles from "./landingLayout.module.css";

const landingNavigationLinks = [
  { href: "#formats", label: "Ad formats" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#targeting", label: "Targeting" },
  { href: "#billing", label: "Billing" },
  { href: "#reporting", label: "Reporting" },
  { href: "#questions", label: "FAQ" },
];

export function LandingHeaderWithFloatingNavigation({ primaryAction }: { readonly primaryAction: LandingAction }) {
  return (
    <header className={styles.header}>
      <div className={styles.headerPill}>
        <Link href="/" className={styles.wordmarkLink} aria-label="Nantty Ads home">
          <ThemeAwareNanttyWordmark productLabel="Ads" height={30} collapseToMarkOnSmallScreens />
        </Link>
        <nav aria-label="Main" className={styles.headerNavigation}>
          <ul>
            {landingNavigationLinks.map((link) => (
              <li key={link.href}>
                <a href={link.href}>{link.label}</a>
              </li>
            ))}
          </ul>
        </nav>
        <ThemeSwitcher iconOnly label="Colour theme" className={styles.themeSwitcher} />
        <div className={styles.headerAction}>
          <LandingActionLink action={{ ...primaryAction, label: primaryAction.href === "/accounts" ? "Open manager" : "Sign in" }} />
        </div>
        <details className={styles.mobileMenu}>
          <summary aria-label="Open navigation">
            <span className="visuallyHidden">Open navigation</span>
            <span className={styles.menuBars} aria-hidden="true" />
          </summary>
          <div className={styles.mobileMenuPanel}>
            <nav aria-label="Mobile">
              <ul>
                {landingNavigationLinks.map((navigationLink) => (
                  <li key={navigationLink.href}><Link href={navigationLink.href}>{navigationLink.label}</Link></li>
                ))}
              </ul>
            </nav>
            <ThemeSwitcher label="Appearance" showLabel className={styles.mobileThemeSwitcher} />
          </div>
        </details>
      </div>
    </header>
  );
}
