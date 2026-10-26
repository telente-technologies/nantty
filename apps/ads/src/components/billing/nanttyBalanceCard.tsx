"use client";

import { ErrorState, LoadingBlock } from "@/components/ui/feedback";
import { Card } from "@/components/ui/surfaces";
import type { AdsQueryState } from "@/hooks/useAdsQuery.hook";
import type { NanttyWalletSummary } from "@/types/nanttyWallet.type";
import { formatWalletLineAmount, readWalletLines } from "@/utils/nanttyWallet.util";

import styles from "./billingPage.module.css";

export function NanttyBalanceCard({ walletQuery }: { readonly walletQuery: AdsQueryState<NanttyWalletSummary> }) {
  const lines = readWalletLines(walletQuery.data);
  return (
    <Card title="Nantty balance" description="Your sales, creator earnings, ad credit and coins are kept separately. They are never added together.">
      {walletQuery.data ? (
        lines.length === 0 ? (
          <p className={styles.muted}>Nothing in your Nantty balance yet.</p>
        ) : (
          <ul className={styles.walletLines} aria-label="Nantty balance">
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
        )
      ) : walletQuery.errorMessage ? (
        <ErrorState error={walletQuery.error} message={walletQuery.errorMessage} onRetry={walletQuery.reload} />
      ) : (
        <LoadingBlock height={180} label="Loading your Nantty balance" />
      )}
    </Card>
  );
}
