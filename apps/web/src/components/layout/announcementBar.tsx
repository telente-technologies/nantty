import Link from "next/link";

import { isPrelaunchMode, siteConfig } from "@/lib/siteConfig.config";

import styles from "./announcementBar.module.css";

export function LaunchAnnouncementBar() {
  if (!isPrelaunchMode) return null;
  return (
    <aside className={styles.bar} aria-label="Launch announcement">
      <p className={styles.message}>
        <span className={styles.badge}>Launching</span>
        <span>
          Nantty opens in {siteConfig.launchCountry} first.{" "}
          <Link href="/#download" className={styles.link}>
          Join the waitlist
          </Link>
        </span>
      </p>
    </aside>
  );
}
