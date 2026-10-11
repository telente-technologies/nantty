"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { ErrorBlock, LoadingBlock, NoticeBanner } from "@/components/ui/feedback";
import { SidePanel } from "@/components/ui/sidePanel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { KeyValueList, SectionHeading } from "@/components/ui/surfaces";
import { useToast } from "@/components/ui/toastProvider";
import { UserIdentity } from "@/components/ui/userIdentity";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { createIdempotencyKey } from "@/services/adminApiClient.service";
import { fetchCoinTransactionDetail, markCoinTransactionReviewed, reverseCoinTransaction } from "@/services/moneyApi.service";
import type { CoinTransactionDetail } from "@/types/coins.type";
import { formatBasisPointsAsPercent, formatDateTime, formatMoneyForDisplay, formatWholeNumber, humanizeConstantName } from "@/utils/formatting.util";
import { toIdentityUser } from "@/utils/partySummary.util";

import styles from "./money.module.css";

function CoinTransactionBody({ coin }: { readonly coin: CoinTransactionDetail }) {
  return (
    <>
      <KeyValueList
        columns={2}
        items={[
          { label: coin.kind === "purchase" ? "Buyer" : "Sender", value: <Link href={`/users/${coin.sender.id}`}><UserIdentity user={toIdentityUser(coin.sender)} size={24} /></Link> },
          { label: "Receiver", value: coin.receiver ? <Link href={`/users/${coin.receiver.id}`}><UserIdentity user={toIdentityUser(coin.receiver)} size={24} /></Link> : "—" },
          { label: "Fiat value", value: <span className={styles.amount}>{formatMoneyForDisplay(coin.fiatValue)}</span> },
          { label: "Platform fee", value: coin.feeCoins !== null ? `${formatWholeNumber(coin.feeCoins)} coins (${formatBasisPointsAsPercent(coin.platformFeeBasisPoints ?? 0)})` : "None on purchases" },
          { label: "Paid with", value: coin.paymentProvider ? `${coin.paymentProvider}${coin.channel ? ` · ${humanizeConstantName(coin.channel)}` : ""}` : "Coin balance" },
          { label: "Transaction", value: <StatusBadge status={coin.transactionStatus} hasDot={false} /> },
          { label: "Reference", value: coin.reference ?? "—", isMono: true },
          { label: "When", value: formatDateTime(coin.createdAt) },
          { label: "Chargeback risk", value: <StatusBadge status={coin.chargebackRisk} /> },
          { label: "Clawback shortfall", value: coin.clawbackShortfallCoins > 0 ? `${formatWholeNumber(coin.clawbackShortfallCoins)} coins` : "None" },
        ]}
      />
      {coin.clawbackShortfallCoins > 0 ? <NoticeBanner tone="caution" title="Coins already spent">The receiver had spent some coins before the clawback. Their withdrawals stay paused until the shortfall is covered.</NoticeBanner> : null}
      <SectionHeading>Rules that flagged this</SectionHeading>
      {coin.reviewFlags.length === 0 ? <p className={styles.muted}>No coin rules hit.</p> : <ul className={styles.reasons}>{coin.reviewFlags.map((flag) => <li key={flag}>{humanizeConstantName(flag)}</li>)}</ul>}
      <SectionHeading>Open account flags</SectionHeading>
      {coin.flags.length === 0 ? <p className={styles.muted}>No open flags on the people involved.</p> : <ul className={styles.reasons}>{coin.flags.map((flag) => <li key={flag}>{humanizeConstantName(flag)}</li>)}</ul>}
      <SectionHeading>History</SectionHeading>
      <ul className={styles.reasons}>
        {coin.history.map((entry, index) => (
          <li key={`${entry.action}-${index}`}>
            {humanizeConstantName(entry.action)} · {formatDateTime(entry.occurredAt)}{entry.staffId ? ` · staff ${entry.staffId}` : ""}{entry.note ? ` · ${entry.note}` : ""}
          </li>
        ))}
      </ul>
    </>
  );
}

export function CoinDetailPanel({ transactionId, onClose, onChanged }: { readonly transactionId: string; readonly onClose: () => void; readonly onChanged: () => void }) {
  const { showToast } = useToast();
  const { data: coin, errorMessage, error: queryError, isLoading, reload, replaceData } = useAdminQuery((signal) => fetchCoinTransactionDetail(transactionId, signal), transactionId);
  const [openAction, setOpenAction] = useState<"review" | "reverse" | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(createIdempotencyKey);
  const reviewMutation = useAdminMutation((note: string) => markCoinTransactionReviewed(transactionId, note));
  const reverseMutation = useAdminMutation((reason: string) => reverseCoinTransaction(transactionId, reason, idempotencyKey));

  async function confirmAction(reason: string) {
    const updated = openAction === "reverse" ? await reverseMutation.run(reason) : await reviewMutation.run(reason);
    if (!updated) return;
    showToast(openAction === "reverse" ? "Coin transaction reversed" : "Marked as reviewed");
    replaceData(() => updated);
    setOpenAction(null);
    setIdempotencyKey(createIdempotencyKey());
    onChanged();
  }

  return (
    <SidePanel
      isOpen
      title={coin ? `${humanizeConstantName(coin.kind)} · ${formatWholeNumber(coin.coins)} coins` : "Coin transaction"}
      subtitle={coin ? <StatusBadge status={coin.reviewStatus} /> : null}
      onClose={onClose}
      footer={
        coin && coin.reviewStatus !== "reversed" ? (
          <>
            {coin.reviewStatus === "pending_review" ? <Button variant="primary" onClick={() => setOpenAction("review")}>Mark reviewed</Button> : null}
            <Button variant="quietDanger" iconName="shield24" onClick={() => setOpenAction("reverse")}>Reverse</Button>
          </>
        ) : null
      }
    >
      {errorMessage ? <ErrorBlock error={queryError} message={errorMessage} onRetry={reload} /> : null}
      {isLoading && !coin ? <LoadingBlock /> : null}
      {coin ? (
        <>
          <CoinTransactionBody coin={coin} />
          <ConfirmActionDialog
            isOpen={openAction !== null}
            title={openAction === "reverse" ? "Reverse coin transaction" : "Mark as reviewed"}
            description={openAction === "reverse" ? `Takes back ${formatWholeNumber(coin.coins)} coins${coin.kind === "purchase" ? ` and refunds ${formatMoneyForDisplay(coin.fiatValue)}` : " and returns them to the sender"}.` : "Clears this transaction from the review queue."}
            consequences={openAction === "reverse" ? ["If the receiver already spent the coins, the shortfall is recorded and their withdrawals are paused.", "Both people are notified."] : []}
            confirmLabel={openAction === "reverse" ? "Reverse transaction" : "Mark reviewed"}
            tone={openAction === "reverse" ? "danger" : "default"}
            requiresReason={openAction === "reverse"}
            requiresStepUp={openAction === "reverse"}
            isBusy={reviewMutation.isRunning || reverseMutation.isRunning}
            errorMessage={openAction === "reverse" ? reverseMutation.errorMessage : reviewMutation.errorMessage}
            onConfirm={confirmAction}
            onClose={() => setOpenAction(null)}
          />
        </>
      ) : null}
    </SidePanel>
  );
}
