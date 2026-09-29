"use client";

import Link from "next/link";
import { useState } from "react";

import { AuditHistoryList } from "@/components/audit/auditHistoryList";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { ErrorBlock, LoadingBlock } from "@/components/ui/feedback";
import { SidePanel } from "@/components/ui/sidePanel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { KeyValueList, SectionHeading } from "@/components/ui/surfaces";
import { useToast } from "@/components/ui/toastProvider";
import { UserIdentity } from "@/components/ui/userIdentity";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { createIdempotencyKey } from "@/services/adminApiClient.service";
import { fetchCoinTransactionDetail, markCoinTransactionReviewed, reverseCoinTransaction } from "@/services/moneyApi.service";
import { formatBasisPointsAsPercent, formatDateTime, formatMoneyForDisplay, formatWholeNumber, humanizeConstantName } from "@/utils/formatting.util";

import styles from "./money.module.css";

export function CoinDetailPanel({ transactionId, onClose, onChanged }: { readonly transactionId: string; readonly onClose: () => void; readonly onChanged: () => void }) {
  const { showToast } = useToast();
  const { data: coin, errorMessage, isLoading, reload, replaceData } = useAdminQuery((signal) => fetchCoinTransactionDetail(transactionId, signal), transactionId);
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
      subtitle={coin ? <StatusBadge status={coin.status} /> : null}
      onClose={onClose}
      footer={
        coin && coin.status !== "REVERSED" ? (
          <>
            {coin.status === "PENDING_REVIEW" ? <Button variant="primary" onClick={() => setOpenAction("review")}>Mark reviewed</Button> : null}
            <Button variant="quietDanger" iconName="shield24" onClick={() => setOpenAction("reverse")}>Reverse</Button>
          </>
        ) : null
      }
    >
      {errorMessage ? <ErrorBlock message={errorMessage} onRetry={reload} /> : null}
      {isLoading && !coin ? <LoadingBlock /> : null}
      {coin ? (
        <>
          <KeyValueList
            columns={2}
            items={[
              { label: coin.kind === "PURCHASE" ? "Buyer" : "Sender", value: <Link href={`/users/${coin.sender.id}`}><UserIdentity user={coin.sender} size={24} /></Link> },
              { label: "Receiver", value: coin.receiver ? <Link href={`/users/${coin.receiver.id}`}><UserIdentity user={coin.receiver} size={24} /></Link> : "—" },
              { label: "Fiat value", value: <span className={styles.amount}>{formatMoneyForDisplay(coin.fiatValue)}</span> },
              { label: "Platform fee", value: coin.platformFee ? `${formatMoneyForDisplay(coin.platformFee)} (${formatBasisPointsAsPercent(coin.platformFeeBasisPoints ?? 0)})` : "None on purchases" },
              { label: "Context", value: coin.context },
              { label: "Paid with", value: coin.paymentProvider ?? "Coin balance" },
              { label: "When", value: formatDateTime(coin.createdAt) },
              { label: "Chargeback risk", value: <StatusBadge status={coin.chargebackRisk} /> },
            ]}
          />
          <SectionHeading>Flags</SectionHeading>
          {coin.flags.length === 0 ? <p className={styles.muted}>No flags raised.</p> : <ul className={styles.reasons}>{coin.flags.map((flag) => <li key={flag}>{flag}</li>)}</ul>}
          <SectionHeading>Admin history</SectionHeading>
          <AuditHistoryList entries={coin.history} />
          <ConfirmActionDialog
            isOpen={openAction !== null}
            title={openAction === "reverse" ? "Reverse coin transaction" : "Mark as reviewed"}
            description={openAction === "reverse" ? `Takes back ${formatWholeNumber(coin.coins)} coins and returns ${coin.kind === "PURCHASE" ? `${formatMoneyForDisplay(coin.fiatValue)} to the card` : "the platform fee"}.` : "Clears this transaction from the review queue."}
            consequences={openAction === "reverse" ? ["The receiver's coin balance is reduced. If it goes negative, their withdrawals are paused.", "Both people are notified."] : []}
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
