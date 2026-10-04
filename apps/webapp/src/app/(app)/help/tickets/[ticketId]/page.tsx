import type { Metadata } from "next";
import Link from "next/link";

import styles from "@/components/help/help.module.css";
import { SupportTicketThread } from "@/components/help/supportTicketThread";

export const metadata: Metadata = { title: "Support request", robots: { index: false } };

export default async function SupportTicketPage({ params }: { readonly params: Promise<{ readonly ticketId: string }> }) {
  const { ticketId } = await params;
  return (
    <div className={styles.page}>
      <Link href="/help/tickets" className={styles.eyebrow}>My support requests</Link>
      <SupportTicketThread ticketId={decodeURIComponent(ticketId)} />
    </div>
  );
}
