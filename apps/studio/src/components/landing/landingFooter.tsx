import Link from "next/link";

import { ThemeSwitcher, ZudomartWordmark } from "@zudomart/web-kit";

import { buildContactMailtoLinkForBothAddresses, contactEmailRecipients } from "@/constants/contact.constant";

import { zudomartMainSiteUrl } from "./landingContent.constant";
import styles from "./landingFooter.module.css";

const linkGroups = [
  { heading: "Studio", links: [{ label: "Sign in", href: "/login" }, { label: "Go live your way", href: "#go-live" }, { label: "Features", href: "#features" }, { label: "Earnings", href: "#earnings" }, { label: "FAQ", href: "#faq" }] },
  { heading: "Zudomart", links: [{ label: "Zudomart.com", href: zudomartMainSiteUrl }, { label: "Join the Creator Program", href: "#creator-program" }, { label: "Sell on Zudomart", href: `${zudomartMainSiteUrl}/sellers` }] },
  {
    heading: "Legal",
    links: [
      { label: "Creator terms", href: `${zudomartMainSiteUrl}/creator-terms` },
      { label: "Community guidelines", href: `${zudomartMainSiteUrl}/community-guidelines` },
      { label: "Privacy policy", href: `${zudomartMainSiteUrl}/privacy` },
      { label: "Cookie policy", href: `${zudomartMainSiteUrl}/cookies` },
      { label: "Terms of service", href: `${zudomartMainSiteUrl}/terms` },
    ],
  },
];

export function LandingFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.topRow}>
        <div className={styles.brandColumn}>
          <ZudomartWordmark productLabel="Studio" tone="onDark" />
          <p>The creator studio for going live on Zudomart. Talk, music, gaming, education and IRL. Built in Nigeria.</p>
          <ul className={styles.emailList} aria-label="Contact email addresses">
            {contactEmailRecipients.map((email) => (
              <li key={email}>
                <a href={buildContactMailtoLinkForBothAddresses("Zudomart Studio")} className={styles.emailLink}>
                  {email}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <nav aria-label="Footer" className={styles.linkGroups}>
          {linkGroups.map((group) => (
            <div key={group.heading}>
              <h2 className={styles.groupHeading}>{group.heading}</h2>
              <ul className={styles.linkList}>
                {group.links.map((link) => (
                  <li key={link.label}>{link.href.startsWith("/") ? <Link href={link.href}>{link.label}</Link> : <a href={link.href}>{link.label}</a>}</li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
      <div className={styles.bottomRow}>
        <p>© {new Date().getFullYear()} Zudomart. Made in Nigeria.</p>
        <p>Creator photography via Unsplash.</p>
        <ThemeSwitcher label="Colour theme" className={styles.themeSwitcher} />
      </div>
      <p className={styles.giantWordmark} aria-hidden="true">
        studio
      </p>
    </footer>
  );
}
