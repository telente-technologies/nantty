import type { Metadata } from "next";
import Link from "next/link";

import { LinkedProfilesSection } from "@/components/settings/linkedProfilesSection";
import styles from "@/components/settings/settings.module.css";
import { IconLabel } from "@/components/ui/appIcon";

export const metadata: Metadata = { title: "Store, Business page and Brand" };

export default function LinkedProfilesPage() {
  return (
    <div className={styles.page}>
      <div>
        <Link href="/settings"><IconLabel name="arrowLeft24" size={16}>Settings</IconLabel></Link>
        <h1 className={styles.title}>Store, Business page and Brand</h1>
      </div>
      <LinkedProfilesSection />
    </div>
  );
}
