"use client";

import { PageHeader } from "@/components/ui/surfaces";

import { AccountDetailsCard, BusinessVerificationCard } from "./accountDetailsCard";
import { MembersCard } from "./membersCard";
import styles from "./settingsPage.module.css";

export function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings & people" description="Account details, business verification and who has access." />
      <div className={styles.layout}>
        <AccountDetailsCard />
        <BusinessVerificationCard />
        <div className={`${styles.fullWidth} ${styles.stack}`} style={{ gap: 16 }}>
          <MembersCard />
        </div>
      </div>
    </>
  );
}
