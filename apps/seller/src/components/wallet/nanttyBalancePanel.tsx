"use client";

import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { ButtonLink } from "@/components/ui/button";
import { Callout, ErrorCallout, LoadingBlock } from "@/components/ui/feedback";
import { Panel } from "@/components/ui/panel";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import type { SellerQueryState } from "@/hooks/useSellerQuery.hook";
import type { WalletLineAmount, ZudomartWalletSummary } from "@/types/zudomartWallet.type";
import { isSupportedCurrencyCode } from "@/utils/money.util";
import { formatCoinCount, readVerificationMessage, readWalletLines } from "@/utils/zudomartWallet.util";

import styles from "./wallet.module.css";

export function WalletVerificationCallout({ summary }: { readonly summary: ZudomartWalletSummary | null }) {
  const { can } = useSellerSession();
  const message = readVerificationMessage(summary);
  if (!message) return null;
  const isBusinessStep = summary?.verification?.nextStep === "business_verification";
  const canAct = can(isBusinessStep ? "billing:manage" : "wallet:withdraw");
  const action = isBusinessStep ? <ButtonLink href="/settings/business-documents" variant="primary" size="small">Verify business</ButtonLink> : <ButtonLink href="/settings/payouts" variant="primary" size="small">Get paid</ButtonLink>;
  const nextStepText = isBusinessStep ? "Finish business verification to withdraw your sales." : "Set up payouts once to withdraw it.";
  return (
    <Callout tone="caution" title={message} action={canAct ? action : null}>
      Your money is safe and waits for you. {canAct ? nextStepText : "Ask the store owner to finish verification."}
    </Callout>
  );
}

export function ZudomartBalancePanel({ walletQuery }: { readonly walletQuery: SellerQueryState<ZudomartWalletSummary> }) {
  const { formatMoney, locale } = useMoneyFormatter();
  const formatLineAmount = (amount: WalletLineAmount) => {
    if (amount.currency === "COIN") return formatCoinCount(amount.amountMinor, locale);
    if (isSupportedCurrencyCode(amount.currency)) return formatMoney({ amountMinor: amount.amountMinor, currency: amount.currency });
    return `${amount.amountMinor} ${amount.currency}`;
  };
  const lines = readWalletLines(walletQuery.data);
  return (
    <Panel title="Zudomart balance" description="Your sales, creator earnings, ad credit and coins are kept separately. They are never added together.">
        {walletQuery.data ? (
          lines.length === 0 ? (
            <p className={styles.muted}>Nothing in your Zudomart balance yet.</p>
          ) : (
            <ul className={styles.releaseList} aria-label="Zudomart balance">
              {lines.map((line) => (
                <li key={line.key} className={styles.releaseRow}>
                  <span className={styles.releaseMain}>
                    <span>{line.label}</span>
                    {line.description ? <span className={styles.muted}>{line.description}</span> : null}
                  </span>
                  <strong>{formatLineAmount(line.amount)}</strong>
                </li>
              ))}
            </ul>
          )
        ) : walletQuery.errorMessage ? (
          <ErrorCallout error={walletQuery.error} message={walletQuery.errorMessage} onRetry={walletQuery.reload} />
        ) : (
          <LoadingBlock label="Loading your Zudomart balance" />
        )}
    </Panel>
  );
}
