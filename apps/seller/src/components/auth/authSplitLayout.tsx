import Link from "next/link";
import type { ReactNode } from "react";

import { DashboardWordmark } from "@/components/layout/sidebarNavigation";

import styles from "./authSplitLayout.module.css";

const syncedThings = ["Products and stock", "Online and in-store orders", "Wallet and payouts", "Customers and loyalty"];

export function AuthSplitLayout({ children }: { readonly children: ReactNode }) {
  return (
    <div className={styles.page}>
      <section className={styles.brandPanel} aria-label="About Zudomart Dashboard">
        <Link href="/" className={styles.brandLink}>
          <DashboardWordmark />
        </Link>
        <div className={styles.brandCopy}>
          <p className={styles.statement}>One account. The app in your pocket, the dashboard at your counter.</p>
          <ul className={styles.syncList} aria-label="Shared with the Zudomart app">
            {syncedThings.map((thing) => (
              <li key={thing}>{thing}</li>
            ))}
          </ul>
        </div>
        <figure className={styles.showcase}>
          <img src="/screenshots/posRegister.webp" alt="The Zudomart Dashboard register with a sale in progress: product grid on the left, a receipt-style cart on the right" width={1180} height={820} className={styles.screenshot} />
          <figcaption className={styles.caption}>
            <img src="/photos/shopCounterOwner.webp" alt="" width={56} height={56} className={styles.captionPhoto} />
            <span>The register keeps selling offline and syncs every sale to your Zudomart wallet when you reconnect.</span>
          </figcaption>
        </figure>
      </section>
      <main id="main-content" className={styles.formPanel}>
        <div className={styles.formInner}>{children}</div>
      </main>
    </div>
  );
}
