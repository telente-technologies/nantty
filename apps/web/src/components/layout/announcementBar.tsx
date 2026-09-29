import Link from "next/link";

import { siteConfig } from "@/lib/siteConfig.config";

import styles from "./announcementBar.module.css";

export function LaunchAnnouncementBar() {
  return (
    <aside className={styles.bar} aria-label="Launch announcement">
      <p className={styles.message}>
        <span className={styles.badge}>Early access</span>
        <span>
          Zudomart opens in {siteConfig.launchCountry} first.{" "}
          <Link href="/#waitlist" className={styles.link}>
            Save your spot
          </Link>
        </span>
      </p>
    </aside>
  );
}
