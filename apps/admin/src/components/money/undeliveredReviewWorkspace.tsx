"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { ErrorBlock } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/pageHeader";
import { CursorPagination } from "@/components/ui/pagination";
import { useToast } from "@/components/ui/toastProvider";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { createIdempotencyKey } from "@/services/adminApiClient.service";
import { decideUndeliveredEscrow, fetchUndeliveredReview } from "@/services/moneyApi.service";
import type { UndeliveredReviewRow } from "@/types/commerce.type";
import { formatMoneyForDisplay, formatRelativeTimeFromNow } from "@/utils/formatting.util";

import styles from "./money.module.css";

type Decision = "release" | "refund";

function safeTrackingUrl(value?: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}

const decisionCopy: Record<Decision, { title: string; confirm: string; toast: string; consequence: string }> = {
  release: { title: "Release to the seller", confirm: "Release payment", toast: "Released to the seller", consequence: "The seller is paid the order amount minus Nantty's fees. Use this only when the seller has shown the order was delivered." },
  refund: { title: "Refund the buyer", confirm: "Refund buyer", toast: "Refunded to the buyer", consequence: "The full amount goes back to the buyer and the seller is not paid." },
};

function DecisionDialog({ row, decision, onClose, onDecided }: { readonly row: UndeliveredReviewRow; readonly decision: Decision; readonly onClose: () => void; readonly onDecided: () => void }) {
  const { showToast } = useToast();
  const [idempotencyKey] = useState(createIdempotencyKey);
  const mutation = useAdminMutation((reason: string) => decideUndeliveredEscrow(row.orderId, decision, reason, idempotencyKey));
  const copy = decisionCopy[decision];

  async function confirm(reason: string) {
    if (await mutation.run(reason)) {
      showToast(`${copy.toast}: ${formatMoneyForDisplay(row.heldAmount)}`);
      onDecided();
      onClose();
    }
  }

  return (
    <ConfirmActionDialog
      isOpen
      title={copy.title}
      description={`Order ${row.orderReference} · ${formatMoneyForDisplay(row.heldAmount)} held since ${formatRelativeTimeFromNow(row.heldSince)}.`}
      consequences={[copy.consequence, "Contact the buyer and the seller before you decide. Your reason is saved in the audit log."]}
      confirmLabel={copy.confirm}
      tone="danger"
      requiresReason
      reasonMaximumLength={300}
      requiresStepUp
      isBusy={mutation.isRunning}
      errorMessage={mutation.errorMessage}
      onConfirm={confirm}
      onClose={onClose}
    />
  );
}

export function UndeliveredReviewWorkspace() {
  const [cursor, setCursor] = useState<string | undefined>();
  const [pending, setPending] = useState<{ readonly row: UndeliveredReviewRow; readonly decision: Decision } | null>(null);
  const { data, errorMessage, error, isLoading, reload } = useAdminQuery((signal) => fetchUndeliveredReview(cursor, signal), cursor ?? "");
  const columns: readonly DataTableColumn<UndeliveredReviewRow>[] = [
    { key: "order", header: "Order", render: (row) => row.orderReference, isMono: true },
    { key: "amount", header: "Held", render: (row) => <span className={styles.amount}>{formatMoneyForDisplay(row.heldAmount)}</span>, align: "end" },
    { key: "parties", header: "Buyer / seller", render: (row) => <span className={styles.stack}><span className="mono">{row.buyerUserId}</span><span className={`mono ${styles.muted}`}>{row.sellerUserId}</span></span> },
    {
      key: "shipping",
      header: "Shipping",
      render: (row) => {
        if (!row.shippedAt) return <span className={styles.muted}>Never marked shipped</span>;
        const trackingUrl = safeTrackingUrl(row.trackingUrl);
        return (
          <span className={styles.stack}>
            <span>{row.courierName} <span className="mono">{row.trackingNumber}</span></span>
            <span className={styles.muted}>shipped {formatRelativeTimeFromNow(row.shippedAt)}</span>
            {trackingUrl ? <a href={trackingUrl} target="_blank" rel="noopener noreferrer">Open carrier tracking</a> : null}
          </span>
        );
      },
    },
    { key: "review", header: "In review", render: (row) => <span className={styles.muted}>{formatRelativeTimeFromNow(row.reviewSince)}</span> },
    { key: "actions", header: "Decision", render: (row) => <span className={styles.stack}><Button onClick={() => setPending({ row, decision: "release" })}>Release</Button><Button onClick={() => setPending({ row, decision: "refund" })}>Refund</Button></span>, align: "end" },
  ];

  return (
    <>
      <PageHeader area="Money" title="Undelivered orders" description="Orders still not marked delivered 30 days after payment. The money stays held: it is never released or refunded automatically. Contact both sides, then release to the seller or refund the buyer." />
      {errorMessage ? <ErrorBlock error={error} message={errorMessage} onRetry={reload} /> : null}
      <DataTable caption="Undelivered orders under review" columns={columns} rows={data?.items ?? []} readRowKey={(row) => row.escrowId} isLoading={isLoading} emptyMessage="No undelivered orders are waiting for review." />
      <CursorPagination cursor={cursor} nextCursor={data?.nextCursor} onCursorChange={setCursor} />
      {pending ? <DecisionDialog row={pending.row} decision={pending.decision} onClose={() => setPending(null)} onDecided={reload} /> : null}
    </>
  );
}
