import type { Metadata } from "next";
import Link from "next/link";

import styles from "@/components/settings/settings.module.css";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Settings</h1>
      <ul className={styles.linkList}>
        <li><Link href="/settings/privacy">Privacy &amp; Data</Link></li>
      </ul>
    </div>
  );
}
