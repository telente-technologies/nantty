import type { Metadata } from "next";
import Link from "next/link";

import styles from "./notFound.module.css";

export const metadata: Metadata = { title: "Page not found", robots: { index: false } };

export default function NotFoundPage() {
  return (
    <main id="main-content" className={styles.scene}>
      <div className={styles.receipt} aria-labelledby="not-found-heading">
        <p className={styles.storeLine}>ZUDOMART DASHBOARD</p>
        <p className={styles.dashed} aria-hidden="true" />
        <p className={styles.row}>
          <span>Item</span>
          <span>Qty</span>
        </p>
        <p className={styles.row}>
          <span>The page you asked for</span>
          <span>0</span>
        </p>
        <p className={styles.dashed} aria-hidden="true" />
        <h1 id="not-found-heading" className={styles.code}>
          404
        </h1>
        <p className={styles.message}>Not in stock. The link may be old or have a typo.</p>
        <p className={styles.dashed} aria-hidden="true" />
        <div className={styles.actions}>
          <Link href="/" className={styles.primaryAction}>
            Back to your dashboard
          </Link>
          <Link href="/pos" className={styles.secondaryAction}>
            Open the register
          </Link>
        </div>
      </div>
    </main>
  );
}
