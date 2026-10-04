import type { Metadata } from "next";
import Link from "next/link";

import { AccountStatusPanel } from "@/components/copyright/accountStatusPanel";
import styles from "@/components/settings/settings.module.css";
import { IconLabel } from "@/components/ui/appIcon";

export const metadata: Metadata = { title: "Account status" };

export default function AccountStatusPage() {
  return (
    <div className={styles.page}>
      <div>
        <Link href="/settings"><IconLabel name="arrowLeft24" size={16}>Settings</IconLabel></Link>
        <h1 className={styles.title}>Account status</h1>
      </div>
      <AccountStatusPanel />
    </div>
  );
}
