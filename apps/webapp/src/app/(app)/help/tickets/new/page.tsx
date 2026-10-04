import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import styles from "@/components/help/help.module.css";
import { NewTicketForm } from "@/components/help/newTicketForm";

export const metadata: Metadata = { title: "Contact support", robots: { index: false } };

export default function NewSupportTicketPage() {
  return (
    <div className={styles.page}>
      <Link href="/help" className={styles.eyebrow}>Help Centre</Link>
      <h1 className={styles.title}>Contact support</h1>
      <p className={styles.lead}>We'll reply here, with a notification and by email.</p>
      <Suspense>
        <NewTicketForm />
      </Suspense>
    </div>
  );
}
