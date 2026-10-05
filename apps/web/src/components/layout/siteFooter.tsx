import Link from "next/link";

import { ThemeSwitcher, defaultZudomartWordmarkVariant, zudomartWordmarkFor } from "@zudomart/web-kit";

import { businessAppLinks, contactEmailDisplayText, contactMailtoHref } from "@/lib/siteConfig.config";

import { CookieSettingsButton } from "./cookieSettingsButton";
import styles from "./siteFooter.module.css";
import { ZudomartWordmarkHomeLink } from "./zudomartWordmark";

const giantWordmark = zudomartWordmarkFor(defaultZudomartWordmarkVariant, 400);

const footerLinkGroups = [
  {
    heading: "Shop",
    links: [
      { label: "How it works", href: "/#how-it-works" },
      { label: "Escrow protection", href: "/#escrow" },
      { label: "Posts, clips and live streams", href: "/#social-shopping" },
      { label: "Creators and badges", href: "/#creators" },
      { label: "Questions", href: "/#questions" },
    ],
  },
  {
    heading: "Business",
    links: [
      { label: "Sell on Zudomart", href: "/sellers" },
      { label: businessAppLinks.sellerDashboard.label, href: businessAppLinks.sellerDashboard.href },
      { label: businessAppLinks.adsManager.label, href: businessAppLinks.adsManager.href },
      { label: "Payouts", href: "/sellers#payouts" },
      { label: "Fees", href: "/sellers#fees" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "Privacy policy", href: "/privacy" },
      { label: "Cookie policy", href: "/cookies" },
      { label: "Terms of service", href: "/terms" },
      { label: "Community guidelines", href: "/community-guidelines" },
      { label: "Seller terms", href: "/seller-terms" },
      { label: "Creator Program terms", href: "/creator-terms" },
      { label: "Ads policy", href: "/ads-policy" },
      { label: "Refund and escrow policy", href: "/refund-escrow-policy" },
    ],
  },
] as const;

function isExternalFooterHref(footerHref: string): boolean {
  return /^https?:\/\//.test(footerHref);
}

export function SiteFooterWithGiantWordmark() {
  const currentYear = new Date().getFullYear();
  return (
    <footer className={styles.footer}>
      <div className={`pageContainer ${styles.topRow}`}>
        <div className={styles.brandColumn}>
          <ZudomartWordmarkHomeLink tone="light" />
          <p className={styles.brandLine}>Social Commerce, built in Nigeria. Real sellers, prices in your local currency, and your money held safely until your order arrives.</p>
          <a href={contactMailtoHref} className={styles.emailLink}>
            {contactEmailDisplayText}
          </a>
        </div>
        <nav aria-label="Footer" className={styles.linkGroups}>
          {footerLinkGroups.map((linkGroup) => (
            <div key={linkGroup.heading}>
              <h2 className={styles.groupHeading}>{linkGroup.heading}</h2>
              <ul className={styles.linkList}>
                {linkGroup.links.map((footerLink) => (
                  <li key={footerLink.href}>
                    {isExternalFooterHref(footerLink.href) ? (
                      <a href={footerLink.href} className={styles.footerLink} target="_blank" rel="noopener noreferrer">
                        {footerLink.label}{"\u00a0↗"}<span className="visuallyHidden"> (opens in a new tab)</span>
                      </a>
                    ) : (
                      <Link href={footerLink.href} className={styles.footerLink}>
                        {footerLink.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
      <div className={`pageContainer ${styles.bottomRow}`}>
        <p>© {currentYear} Zudomart. Made in Nigeria. <CookieSettingsButton className={styles.footerLink} /></p>
        <p>Prices in your local currency. Payments held in escrow until delivery is confirmed.</p>
        <ThemeSwitcher label="Colour theme" className={styles.themeSwitcher} />
      </div>
      <div className={styles.giantWordmark} aria-hidden="true">
        <svg viewBox={`0 0 ${giantWordmark.width} ${giantWordmark.height}`} focusable="false">
          <path d={giantWordmark.d} fill="currentColor" />
        </svg>
      </div>
    </footer>
  );
}
