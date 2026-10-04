import Link from "next/link";

import { ZudomartWordmark } from "@zudomart/web-kit";
import { buildContactMailtoLink } from "@/constants/contact.constant";

import styles from "./notFound.module.css";

export default function NotFound() {
  return (
    <div className={styles.page}>
      <header className={styles.bar}>
        <Link href="/" aria-label="Zudomart Ads home" className={styles.wordmarkLink}>
          <ZudomartWordmark productLabel="Ads" tone="onDark" />
        </Link>
      </header>
      <main id="main-content" className={styles.main}>
        <p className={styles.code} aria-hidden>
          4<span className={styles.tag}>0</span>4
        </p>
        <h1 className={styles.heading}>This page ran out of budget.</h1>
        <p className={styles.lede}>The link may be old, or the campaign, ad or page was deleted. Nothing was charged.</p>
        <div className={styles.actions}>
          <Link href="/accounts" className={styles.primaryLink}>
            Go to your ad accounts
          </Link>
          <Link href="/" className={styles.secondaryLink}>
            Zudomart Ads home
          </Link>
          <a href={buildContactMailtoLink("Broken link in Zudomart Ads")} className={styles.secondaryLink}>
            Report a broken link
          </a>
        </div>
      </main>
    </div>
  );
}
