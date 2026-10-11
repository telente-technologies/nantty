"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { CoinPurchaseDialog } from "@/components/live/coinPurchaseDialog";
import { PayoutSetupCard } from "@/components/wallet/payoutSetupCard";
import { InlineLink, RetryButton } from "@/components/ui/controls";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { ArrowRightIcon, CoinIcon, WalletIcon } from "@/components/ui/icons";
import { ListRowsSkeleton } from "@/components/ui/pageSkeletons";
import { VerifyToWithdrawBanner } from "@/components/wallet/verifyToWithdrawBanner";
import { walletsService } from "@/services/wallets.service";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";
import { formatWalletLineAmount, readVerifyToWithdrawMessage, readWalletLines, verifyActionForWallet } from "@/utils/walletLines.util";

import styles from "./page.module.css";

export default function WalletPage() {
  const summary = useQuery({ queryKey: ["wallet", "summary"], queryFn: () => walletsService.fetchMyWalletSummary() });
  const transactions = useQuery({ queryKey: ["wallet", "transactions"], queryFn: () => walletsService.listMyTransactions() });
  const escrow = useQuery({ queryKey: ["wallet", "escrow"], queryFn: () => walletsService.listMyEscrowHolds() });
  const [buyCoinsOpen, setBuyCoinsOpen] = useState(false);
  const loading = summary.isLoading || transactions.isLoading;
  if (loading) return <ListRowsSkeleton label="Loading wallet" rows={6} />;
  if (summary.isError || !summary.data) return <ErrorState description="We couldn't load your wallet." action={<RetryButton onRetry={() => summary.refetch()} />} />;

  const recent = (transactions.data ?? []).slice(0, 5);
  const lines = readWalletLines(summary.data);
  const verifyMessage = readVerifyToWithdrawMessage(summary.data);
  const verifyAction = verifyActionForWallet(summary.data, "/wallet/payouts#payout-accounts");
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Wallet</h1>
      {verifyMessage ? <VerifyToWithdrawBanner message={verifyMessage} href={verifyAction.href} actionLabel={verifyAction.label} /> : <PayoutSetupCard />}
      <ul className={styles.grid} aria-label="Balances">
        {lines.map((line, index) => (
          <li key={`${line.key}:${index}`} className={styles.card}>
            <span className={styles.label}>{line.label}</span>
            <span className={styles.value}>{formatWalletLineAmount(line)}</span>
            {line.description ? <span className={styles.cardNote}>{line.description}</span> : null}
          </li>
        ))}
      </ul>
      <p className={styles.cardNote}>
        Each balance is kept separately. Escrow money is released when buyers confirm delivery (or 3 days after delivery), then passes a short safety hold before it becomes available.
      </p>
      <div className={styles.actions}>
        {summary.data.available.amountMinor > 0 ? (
          <Link className={styles.primary} href="/wallet/payouts"><WalletIcon size={18} /> Withdraw</Link>
        ) : (
          <span className={styles.primary} aria-disabled="true" data-disabled="true"><WalletIcon size={18} /> Withdraw</span>
        )}
        <Link className={styles.linkButton} href="/wallet/add-money">Add money</Link>
        <button type="button" className={styles.linkButton} onClick={() => setBuyCoinsOpen(true)}><CoinIcon size={18} /> Buy coins</button>
      </div>
      {(escrow.data ?? []).length > 0 ? (
        <section className={styles.section} aria-label="Held in escrow">
          <h2 className={styles.sectionTitle}>Held in escrow</h2>
          <ul className={styles.list}>
            {(escrow.data ?? []).map((hold) => (
              <li key={hold.orderId} className={styles.row}>
                <span className={styles.rowMain}>
                  <Link className={styles.rowTitle} href={`/seller/orders/${encodeURIComponent(hold.orderId)}`}>{hold.productName}</Link>
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
      <CoinPurchaseDialog isOpen={buyCoinsOpen} onClose={() => setBuyCoinsOpen(false)} />
    </div>
  );
}
