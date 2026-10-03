import Link from "next/link";
import type { ReactNode } from "react";

import { DashboardWordmark } from "@/components/layout/sidebarNavigation";

import styles from "./authSplitLayout.module.css";

const syncedThings = ["Products and stock", "Orders from the app", "Wallet and payouts", "Customers and messages"];

export function AuthSplitLayout({ children }: { readonly children: ReactNode }) {
  return (
    <div className={styles.page}>
      <section className={styles.brandPanel} aria-label="About Zudomart Dashboard">
        <Link href="/" className={styles.brandLink}>
          <DashboardWordmark />
        </Link>
        <div className={styles.brandCopy}>
          <p className={styles.statement}>One account. Sell from anywhere with the app, run your business here.</p>
          <ul className={styles.syncList} aria-label="Shared with the Zudomart app">
            {syncedThings.map((thing) => (
              <li key={thing}>{thing}</li>
            ))}
          </ul>
        </div>
        <figure className={styles.showcase}>
          <img src="/screenshots/dashboardOverview.webp" alt="The Zudomart Dashboard overview with sales, orders by status and wallet balances" width={1440} height={900} className={styles.screenshot} />
          <figcaption className={styles.caption}>
            <img src="/photos/shopCounterOwner.webp" alt="" width={56} height={56} className={styles.captionPhoto} />
            <span>Free for every Zudomart seller — upgrade to Pro or Business when you grow.</span>
          </figcaption>
        </figure>
      </section>
      <main id="main-content" className={styles.formPanel}>
        <div className={styles.formInner}>{children}</div>
      </main>
    </div>
  );
}
