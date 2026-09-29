import Link from "next/link";

import { siteConfig } from "@/lib/siteConfig.config";

import styles from "./siteFooter.module.css";
import { ZudomartWordmarkHomeLink } from "./zudomartWordmark";

const footerLinkGroups = [
  {
    heading: "Shop",
    links: [
      { label: "How it works", href: "/#how-it-works" },
      { label: "Escrow protection", href: "/#escrow" },
      { label: "Posts, clips and live", href: "/#social-shopping" },
      { label: "Questions", href: "/#questions" },
    ],
  },
  {
    heading: "Sell",
    links: [
      { label: "Sell on Zudomart", href: "/sellers" },
      { label: "Seller dashboard", href: "/sellers#dashboard" },
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
      { label: "Terms of service", href: "/terms" },
    ],
  },
] as const;

export function SiteFooterWithGiantWordmark() {
  const currentYear = new Date().getFullYear();
  return (
    <footer className={styles.footer}>
      <div className={`pageContainer ${styles.topRow}`}>
        <div className={styles.brandColumn}>
          <ZudomartWordmarkHomeLink tone="light" />
          <p className={styles.brandLine}>Social shopping, built in Nigeria. Real sellers, prices in your local currency, and your money held safely until your order arrives.</p>
          <a href={`mailto:${siteConfig.contactEmails.general}`} className={styles.emailLink}>
            {siteConfig.contactEmails.general}
          </a>
        </div>
        <nav aria-label="Footer" className={styles.linkGroups}>
          {footerLinkGroups.map((linkGroup) => (
            <div key={linkGroup.heading}>
              <h2 className={styles.groupHeading}>{linkGroup.heading}</h2>
              <ul className={styles.linkList}>
                {linkGroup.links.map((footerLink) => (
                  <li key={footerLink.href}>
                    <Link href={footerLink.href} className={styles.footerLink}>
                      {footerLink.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
      <div className={`pageContainer ${styles.bottomRow}`}>
        <p>© {currentYear} Zudomart. Made in Nigeria.</p>
        <p>Prices in your local currency. Payments held in escrow until delivery is confirmed.</p>
      </div>
      <p className={styles.giantWordmark} aria-hidden="true">
        zudomart
      </p>
    </footer>
  );
}
