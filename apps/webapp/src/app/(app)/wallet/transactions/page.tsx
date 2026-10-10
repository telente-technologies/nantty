"use client";

import { useQuery } from "@tanstack/react-query";

import { RetryButton } from "@/components/ui/controls";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { ListRowsSkeleton } from "@/components/ui/pageSkeletons";
import { walletsService } from "@/services/wallets.service";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

import styles from "../page.module.css";

export default function WalletTransactionsPage() {
  const transactions = useQuery({ queryKey: ["wallet", "transactions", "all"], queryFn: () => walletsService.listMyTransactions() });
  if (transactions.isLoading) return <ListRowsSkeleton label="Loading transactions" rows={8} />;
  if (transactions.isError || !transactions.data) return <ErrorState description="We couldn't load transactions." action={<RetryButton onRetry={() => transactions.refetch()} />} />;
  if (transactions.data.length === 0) return <EmptyState title="No transactions yet" description="Payments, refunds and payouts will show up here." />;
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Transactions</h1>
      <ul className={styles.list}>
        {transactions.data.map((entry) => (
          <li key={entry.id} className={styles.row}>
            <span className={styles.rowMain}>
              <span className={styles.rowTitle}>{entry.description}</span>
              <span className={styles.rowMeta}>{new Date(entry.createdAt).toLocaleString()} · {entry.status}</span>
            </span>
            <span className={[styles.amount, entry.kind === "credit" ? styles.amountCredit : ""].filter(Boolean).join(" ")}>
              {entry.kind === "credit" ? "+" : "−"}{formatMoneyForDisplay(entry.amount)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
