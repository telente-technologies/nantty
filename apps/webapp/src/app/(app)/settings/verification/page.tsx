import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import styles from "@/components/settings/settings.module.css";
import { IconLabel } from "@/components/ui/appIcon";
import { IdentityVerificationHub } from "@/components/verification/identityVerificationHub";

export const metadata: Metadata = { title: "Verification" };

export default function VerificationPage() {
  return (
    <div className={styles.page}>
      <div>
        <Link href="/settings"><IconLabel name="arrowLeft24" size={16}>Settings</IconLabel></Link>
        <h1 className={styles.title}>Verification</h1>
      </div>
      <Suspense fallback={null}>
        <IdentityVerificationHub />
      </Suspense>
    </div>
  );
}
