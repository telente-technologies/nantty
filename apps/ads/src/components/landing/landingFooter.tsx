import Link from "next/link";

import { NanttyWordmark, ThemeSwitcher } from "@nantty/web-kit";
import { buildContactMailtoLink, contactEmailDisplayText, readNanttyMainSiteUrl } from "@/constants/contact.constant";

import styles from "./landingFooter.module.css";
import { PrelaunchLoginAction } from "./prelaunchLoginAction";

export function LandingFooterWithContact() {
  const mainSiteUrl = readNanttyMainSiteUrl();
  return (
    <footer className={styles.footer}>
      <div className={`${styles.container} ${styles.footerTop}`}>
        <div className={styles.footerBrand}>
          <NanttyWordmark productLabel="Ads" tone="onDark" withSymbol />
          <p>Ads for the Nantty marketplace: Marketplace, Feed, Reels and Live. Built in Nigeria.</p>
          <a href={buildContactMailtoLink("Nantty Ads")} className={styles.footerEmail}>
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
                <Link href={process.env.NEXT_PUBLIC_NANTTY_STATIC_PRELAUNCH === "1" ? `${mainSiteUrl}/ads-policy` : "/policy"}>Advertising policies</Link>
              </li>
              <li>
                <a href={`${mainSiteUrl}/privacy`}>Privacy policy</a>
              </li>
              <li>
                <a href={`${mainSiteUrl}/terms`}>Terms of service</a>
              </li>
              <li>
                <a href={`${mainSiteUrl}/ads-policy`}>Ads policy (legal)</a>
              </li>
            </ul>
          </div>
          <div>
            <h2>Nantty</h2>
            <ul>
              <li>
                <a href={mainSiteUrl}>Get the app</a>
              </li>
              <li>
                <a href={`${mainSiteUrl}/sellers`}>Sell on Nantty</a>
              </li>
              <li>
                <PrelaunchLoginAction>Sign in</PrelaunchLoginAction>
              </li>
            </ul>
          </div>
        </nav>
      </div>
      <div className={`${styles.container} ${styles.footerBottom}`}>
        <p>© {new Date().getFullYear()} Nantty. Made in Nigeria.</p>
        <p>Budgets and billing in your local currency.</p>
        <ThemeSwitcher label="Colour theme" className={styles.themeSwitcher} />
      </div>
      <p className={styles.giantWordmark} aria-hidden="true">Nantty</p>
    </footer>
  );
}
