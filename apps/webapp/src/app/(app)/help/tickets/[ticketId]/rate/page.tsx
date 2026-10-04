import type { Metadata } from "next";
import Link from "next/link";

import styles from "@/components/help/help.module.css";
import { SupportTicketThread } from "@/components/help/supportTicketThread";

export const metadata: Metadata = { title: "Rate support", robots: { index: false } };

interface RateTicketPageProps {
  readonly params: Promise<{ readonly ticketId: string }>;
  readonly searchParams: Promise<{ readonly score?: string }>;
}

export default async function RateSupportTicketPage({ params, searchParams }: RateTicketPageProps) {
  const [{ ticketId }, { score }] = await Promise.all([params, searchParams]);
  const initialScore = Number(score);
  return (
    <div className={styles.page}>
      <Link href="/help/tickets" className={styles.eyebrow}>My support requests</Link>
      <SupportTicketThread ticketId={decodeURIComponent(ticketId)} initialScore={Number.isInteger(initialScore) ? initialScore : undefined} />
    </div>
  );
}
