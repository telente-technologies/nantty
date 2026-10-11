"use client";

import type { UseQueryResult } from "@tanstack/react-query";

import { ErrorState, Skeleton } from "@/components/ui/feedback";
import type { ZudomartWalletSummary } from "@/types/zudomartWallet.type";
import { formatWalletLineAmount, readVerificationMessage, readWalletLines } from "@/utils/zudomartWallet.util";

import styles from "./payoutOnboarding.module.css";

export function WalletVerificationBanner({ summary, payoutSetupHref }: { readonly summary: ZudomartWalletSummary | undefined; readonly payoutSetupHref: string }) {
  const message = readVerificationMessage(summary);
  if (!message) return null;
  return (
    <div className={styles.banner} role="status">
      <div className={styles.bannerText}>
        <strong>{message}</strong>
        <p className={styles.muted}>Your earnings are safe and wait for you. Set up payouts once to withdraw them.</p>
      </div>
      <a href={payoutSetupHref} className={styles.bannerLink}>Get paid</a>
    </div>
  );
}

export function ZudomartBalanceCard({ wallet }: { readonly wallet: UseQueryResult<ZudomartWalletSummary> }) {
  if (wallet.isError) return <ErrorState title="Your Zudomart balance didn't load" error={wallet.error} onRetry={() => void wallet.refetch()} />;
  if (!wallet.data) return <Skeleton height={220} />;
  const lines = readWalletLines(wallet.data);
  return (
    <section className={styles.walletCard} aria-label="Zudomart balance">
      <strong>Zudomart balance</strong>
      <p className={styles.muted}>Sales, creator earnings, ad credit and coins are kept separately and never added together.</p>
      {lines.length === 0 ? (
        <p className={styles.muted}>Nothing in your Zudomart balance yet.</p>
      ) : (
        <ul className={styles.walletLines}>
          {lines.map((line) => (
            <li key={line.key} className={styles.walletLine}>
              <span className={styles.walletLineText}>
                <span>{line.label}</span>
                {line.description ? <span className={styles.muted}>{line.description}</span> : null}
              </span>
              <strong>{formatWalletLineAmount(line.amount)}</strong>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
