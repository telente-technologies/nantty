import Link from "next/link";
import type { ReactNode } from "react";

import { AdsWordmark } from "@/components/shell/adsWordmark";
import { UserMenu } from "@/components/shell/userMenu";

import styles from "./standaloneFrame.module.css";

export function StandaloneFrame({ children, showUserMenu = true, width = "regular" }: { readonly children: ReactNode; readonly showUserMenu?: boolean; readonly width?: "regular" | "narrow" }) {
  return (
    <div className={styles.frame}>
      <header className={styles.bar}>
        <Link href="/accounts" className={styles.wordmarkLink} aria-label="Zudomart Ads Manager home">
          <AdsWordmark />
        </Link>
        <nav aria-label="Help" className={styles.links}>
          <Link href="/policy">Advertising policies</Link>
        </nav>
        {showUserMenu ? <UserMenu /> : null}
      </header>
      <main id="main-content" className={width === "narrow" ? `${styles.main} ${styles.narrow}` : styles.main}>
        {children}
      </main>
    </div>
  );
}
