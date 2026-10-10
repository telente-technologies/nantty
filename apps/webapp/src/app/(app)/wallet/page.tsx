"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRightIcon, CoinsIcon, WalletIcon } from "@phosphor-icons/react/dist/ssr";

import { InlineLink, RetryButton } from "@/components/ui/controls";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { ListRowsSkeleton } from "@/components/ui/pageSkeletons";
import { walletsService } from "@/services/wallets.service";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

import styles from "./page.module.css";

export default function WalletPage() {
  const summary = useQuery({ queryKey: ["wallet", "summary"], queryFn: () => walletsService.fetchMyWalletSummary() });
  const coins = useQuery({ queryKey: ["coins", "balance"], queryFn: () => walletsService.fetchMyCoinBalance() });
  const transactions = useQuery({ queryKey: ["wallet", "transactions"], queryFn: () => walletsService.listMyTransactions() });
  const escrow = useQuery({ queryKey: ["wallet", "escrow"], queryFn: () => walletsService.listMyEscrowHolds() });
  const loading = summary.isLoading || coins.isLoading || transactions.isLoading;
  if (loading) return <ListRowsSkeleton label="Loading wallet" rows={6} />;
  if (summary.isError) return <ErrorState description="We couldn't load your wallet." action={<RetryButton onRetry={() => summary.refetch()} />} />;

  const recent = (transactions.data ?? []).slice(0, 5);
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Wallet</h1>
      <div className={styles.grid}>
        <div className={styles.card}>
          <span className={styles.label}>Available</span>
          <span className={styles.value}>{summary.data ? formatMoneyForDisplay(summary.data.available) : "—"}</span>
        </div>
        <div className={styles.card}>
          <span className={styles.label}>Pending in escrow</span>
          <span className={styles.value}>{summary.data ? formatMoneyForDisplay(summary.data.pending) : "—"}</span>
        </div>
        <div className={styles.card}>
          <span className={styles.label}>Coins</span>
          <span className={styles.value}>{coins.data ? coins.data.coins.toLocaleString() : "—"}</span>
        </div>
      </div>
      <p className={styles.note}>Pending money is held in escrow until buyers confirm delivery, then it moves to your available balance.</p>
      <div className={styles.actions}>
        <Link className={styles.primary} href="/wallet/payouts"><WalletIcon size={18} /> Withdraw</Link>
        <Link className={styles.linkButton} href="/wallet/coins"><CoinsIcon size={18} /> Coins</Link>
      </div>
      {(escrow.data ?? []).length > 0 ? (
        <section className={styles.section} aria-label="Held in escrow">
          <h2 className={styles.sectionTitle}>Held in escrow</h2>
          <ul className={styles.list}>
            {(escrow.data ?? []).map((hold) => (
              <li key={hold.orderId} className={styles.row}>
                <span className={styles.rowMain}>
                  <span className={styles.rowTitle}>{hold.productName}</span>
                  <span className={styles.rowMeta}>{hold.orderReference}</span>
                </span>
                <span className={styles.amount}>{formatMoneyForDisplay(hold.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className={styles.section} aria-label="Recent activity">
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Recent activity</h2>
          <InlineLink href="/wallet/transactions">All transactions <ArrowRightIcon size={14} /></InlineLink>
        </div>
        {transactions.isError ? (
          <ErrorState description="We couldn't load recent activity." action={<RetryButton onRetry={() => transactions.refetch()} />} />
        ) : recent.length === 0 ? (
          <EmptyState title="No activity yet" description="Payments, refunds and payouts will show up here." />
        ) : (
          <ul className={styles.list}>
            {recent.map((entry) => (
              <li key={entry.id} className={styles.row}>
                <span className={styles.rowMain}>
                  <span className={styles.rowTitle}>{entry.description}</span>
                  <span className={styles.rowMeta}>{new Date(entry.createdAt).toLocaleDateString()} · {entry.status}</span>
                </span>
                <span className={[styles.amount, entry.kind === "credit" ? styles.amountCredit : ""].filter(Boolean).join(" ")}>
                  {entry.kind === "credit" ? "+" : "−"}{formatMoneyForDisplay(entry.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <nav className={styles.links} aria-label="Wallet sections">
        <Link className={styles.linkButton} href="/wallet/transactions">Transactions</Link>
        <Link className={styles.linkButton} href="/wallet/payouts">Payout accounts & withdraw</Link>
        <Link className={styles.linkButton} href="/wallet/coins">Coin activity</Link>
        <Link className={styles.linkButton} href="/store-rewards">Store rewards</Link>
      </nav>
    </div>
  );
}
