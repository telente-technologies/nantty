import type { Metadata } from "next";
import Link from "next/link";

import { MyReportsList } from "@/components/settings/myReportsList";
import styles from "@/components/settings/settings.module.css";
import { IconLabel } from "@/components/ui/appIcon";

export const metadata: Metadata = { title: "Your reports" };

export default function MyReportsPage() {
  return (
    <div className={styles.page}>
      <div>
        <Link href="/settings"><IconLabel name="arrowLeft24" size={16}>Settings</IconLabel></Link>
        <h1 className={styles.title}>Your reports</h1>
      </div>
      <MyReportsList />
    </div>
  );
}
