import Link from "next/link";

import { ZudomartWordmark } from "@zudomart/web-kit";
import { buildContactMailtoLink, contactEmailDisplayText, readZudomartMainSiteUrl } from "@/constants/contact.constant";

import styles from "./landingFooter.module.css";

export function LandingFooterWithContact() {
  const mainSiteUrl = readZudomartMainSiteUrl();
  return (
    <footer className={styles.footer}>
      <div className={`${styles.container} ${styles.footerTop}`}>
        <div className={styles.footerBrand}>
          <ZudomartWordmark productLabel="Ads" tone="onDark" />
          <p>Ads for the Zudomart marketplace: Marketplace, Feed, Reels and Live. Built in Nigeria.</p>
          <a href={buildContactMailtoLink("Zudomart Ads")} className={styles.footerEmail}>
            {contactEmailDisplayText}
          </a>
        </div>
        <nav aria-label="Footer" className={styles.footerLinks}>
          <div>
            <h2>Advertise</h2>
            <ul>
              <li>
                <a href="#formats">Ad formats</a>
              </li>
              <li>
                <a href="#how-it-works">Create a campaign</a>
              </li>
              <li>
                <a href="#questions">Questions</a>
              </li>
            </ul>
          </div>
          <div>
            <h2>Rules</h2>
            <ul>
              <li>
                <Link href="/policy">Advertising policies</Link>
              </li>
              <li>
                <a href={`${mainSiteUrl}/privacy`}>Privacy policy</a>
              </li>
              <li>
                <a href={`${mainSiteUrl}/terms`}>Terms of service</a>
              </li>
            </ul>
          </div>
          <div>
            <h2>Zudomart</h2>
            <ul>
              <li>
                <a href={mainSiteUrl}>Get the app</a>
              </li>
              <li>
                <a href={`${mainSiteUrl}/sellers`}>Sell on Zudomart</a>
              </li>
              <li>
                <Link href="/login">Sign in</Link>
              </li>
            </ul>
          </div>
        </nav>
      </div>
      <div className={`${styles.container} ${styles.footerBottom}`}>
        <p>© {new Date().getFullYear()} Zudomart. Budgets and billing in your local currency.</p>
      </div>
      <p className={styles.giantWordmark} aria-hidden>
        zudomart ads
      </p>
    </footer>
  );
}
