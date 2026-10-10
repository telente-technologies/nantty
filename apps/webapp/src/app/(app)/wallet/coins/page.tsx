"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { RetryButton } from "@/components/ui/controls";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { ListRowsSkeleton } from "@/components/ui/pageSkeletons";
import { coinsService } from "@/services/webActions.service";

import styles from "../page.module.css";

export default function WalletCoinsPage() {
  const balance = useQuery({ queryKey: ["coins", "balance"], queryFn: () => coinsService.fetchCoinBalance() });
  const activity = useQuery({ queryKey: ["coins", "activity"], queryFn: () => coinsService.fetchCoinActivity() });
  const packages = useQuery({ queryKey: ["coins", "packages"], queryFn: () => coinsService.fetchWebCoinPackages() });
  if (balance.isLoading || activity.isLoading) return <ListRowsSkeleton label="Loading coins" rows={6} />;
  if (balance.isError || activity.isError) return <ErrorState description="We couldn't load your coins." action={<RetryButton onRetry={() => { void balance.refetch(); void activity.refetch(); }} />} />;
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Coins</h1>
      <div className={styles.card}>
        <span className={styles.label}>Balance</span>
        <span className={styles.value}>{(balance.data?.coins ?? 0).toLocaleString()}</span>
      </div>
      <p className={styles.note}>Use coins to send gifts and tips to creators. Top up from a live room or gift tray.</p>
      <section className={styles.section} aria-label="Coin activity">
        <h2 className={styles.sectionTitle}>Activity</h2>
        {(activity.data ?? []).length === 0 ? (
          <EmptyState title="No coin activity" description="Coin purchases, gifts and tips will show up here." />
        ) : (
          <ul className={styles.list}>
            {(activity.data ?? []).map((entry) => (
              <li key={entry.id} className={styles.row}>
                <span className={styles.rowMain}>
                  <span className={styles.rowTitle}>{entry.type === "credit" ? "Received" : "Sent"} · {entry.coins.toLocaleString()} coins</span>
                  <span className={styles.rowMeta}>{new Date(entry.createdAt).toLocaleString()} · Balance {entry.balanceAfter.toLocaleString()}</span>
                </span>
                <span className={[styles.amount, entry.type === "credit" ? styles.amountCredit : ""].filter(Boolean).join(" ")}>
                  {entry.type === "credit" ? "+" : "−"}{entry.coins.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className={styles.section} aria-label="Coin packages">
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Top-up packages</h2>
          <Link className={styles.linkButton} href="/live">Open live to buy</Link>
        </div>
        <p className={styles.note}>{(packages.data ?? []).length} packages available · coin checkout opens from the live gift tray.</p>
      </section>
    </div>
  );
}
