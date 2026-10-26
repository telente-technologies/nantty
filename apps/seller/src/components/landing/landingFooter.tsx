import Link from "next/link";

import { ThemeSwitcher } from "@nantty/web-kit";

import { NanttyWordmark } from "@nantty/web-kit";
import { contactEmailDisplayText, contactMailtoHref } from "@/config/siteMetadata.config";

import styles from "./landingFooter.module.css";
import { PrelaunchLoginAction } from "./prelaunchLoginAction";

export function LandingFooter({ marketingSiteUrl, adsManagerUrl }: { readonly marketingSiteUrl: string; readonly adsManagerUrl: string }) {
  const linkGroups = [
    { heading: "Dashboard", links: process.env.NEXT_PUBLIC_NANTTY_STATIC_PRELAUNCH === "1"
      ? [{ label: "Sign in", locked: true }, { label: "Features", href: "/#features" }, { label: "Pricing", href: "/#pricing" }]
      : [{ label: "Sign in", href: "/login" }, { label: "Features", href: "/#features" }, { label: "Pricing", href: "/#pricing" }, { label: "Reset password", href: "/forgot-password" }] },
    { heading: "Nantty", links: [{ label: "Nantty.com", href: marketingSiteUrl }, { label: "Sell on Nantty", href: `${marketingSiteUrl}/sellers` }, { label: "Ads Manager", href: adsManagerUrl }] },
    { heading: "Legal", links: [{ label: "Privacy policy", href: `${marketingSiteUrl}/privacy` }, { label: "Terms of service", href: `${marketingSiteUrl}/terms` }, { label: "Seller terms", href: `${marketingSiteUrl}/seller-terms` }, { label: "Refund and escrow policy", href: `${marketingSiteUrl}/refund-escrow-policy` }] },
  ];
  return (
    <footer className={styles.footer}>
      <div className={styles.topRow}>
        <div className={styles.brandColumn}>
          <span className={styles.wordmark}>
            <NanttyWordmark productLabel="Dashboard" tone="onDark" height={22} withSymbol />
          </span>
          <p>Sell from anywhere with the app. Run your business with the dashboard. Free for every Nantty seller. Nigeria first.</p>
          <a href={contactMailtoHref} className={styles.emailLink}>
            {contactEmailDisplayText}
          </a>
        </div>
        <nav aria-label="Footer" className={styles.linkGroups}>
          {linkGroups.map((group) => (
            <div key={group.heading}>
              <h2 className={styles.groupHeading}>{group.heading}</h2>
              <ul className={styles.linkList}>
                {group.links.map((link) => (
                  <li key={link.label}>
                    {"locked" in link && link.locked ? <PrelaunchLoginAction className={styles.footerLink}>{link.label}</PrelaunchLoginAction>
                      : link.href?.startsWith("/") ? <Link href={link.href}>{link.label}</Link> : link.href ? <a href={link.href}>{link.label}</a> : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
      <div className={styles.bottomRow}>
        <p>© {new Date().getFullYear()} Nantty. Made in Nigeria.</p>
        <p>Online orders are paid into escrow and released after delivery.</p>
        <ThemeSwitcher label="Colour theme" className={styles.themeSwitcher} />
      </div>
      <p className={styles.giantWordmark} aria-hidden="true">
        dashboard
      </p>
    </footer>
  );
}
