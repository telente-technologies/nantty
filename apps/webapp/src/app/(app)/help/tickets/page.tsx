import type { Metadata } from "next";
import Link from "next/link";

import styles from "@/components/help/help.module.css";
import { SupportTicketList } from "@/components/help/supportTicketList";

export const metadata: Metadata = { title: "My support requests", robots: { index: false } };

export default function SupportTicketsPage() {
  return (
    <div className={styles.page}>
      <Link href="/help" className={styles.eyebrow}>Help Centre</Link>
      <h1 className={styles.title}>My support requests</h1>
      <div className={styles.row}><Link href="/help/tickets/new" className={styles.button}>Contact support</Link></div>
      <SupportTicketList />
    </div>
  );
}
