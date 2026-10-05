import Link from "next/link";

import { siteConfig } from "@/lib/siteConfig.config";

import styles from "./announcementBar.module.css";

export function LaunchAnnouncementBar() {
  return (
    <aside className={styles.bar} aria-label="Launch announcement">
      <p className={styles.message}>
        <span className={styles.badge}>Launching</span>
        <span>
          Zudomart opens in {siteConfig.launchCountry} first.{" "}
          <Link href="/#download" className={styles.link}>
            Get the app
          </Link>
        </span>
      </p>
    </aside>
  );
}
