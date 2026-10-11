"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { EscrowSummaryCard, EscrowTimeline } from "@/components/escrow/escrowCards";
import { ErrorState } from "@/components/ui/feedback";
import { ListRowsSkeleton } from "@/components/ui/pageSkeletons";
import { showToast } from "@/components/ui/toast";
import { createIdempotencyKey, readErrorMessageForDisplay, WebappRequestError } from "@/services/clientApi.service";
import { escrowQueryKeys, escrowsService } from "@/services/disputes.service";
import { sellerService } from "@/services/seller.service";
import { formatFriendlyDate } from "@/utils/escrowStage.util";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

import styles from "../../page.module.css";

export default function SellerOrderDetailPage() {
  const params = useParams<{ orderId: string }>();
  const orderId = params.orderId;
  const queryClient = useQueryClient();
  const order = useQuery({ queryKey: ["seller", "order", orderId], queryFn: () => sellerService.fetchStoreOrderById(orderId) });
  const escrowQuery = useQuery({ queryKey: escrowQueryKeys.forOrder(orderId), queryFn: () => escrowsService.fetchEscrowForOrder(orderId), retry: false });
  const shipKey = useRef(createIdempotencyKey("ship"));
  const [courierName, setCourierName] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const ship = useMutation({
    mutationFn: () => sellerService.markStoreOrderAsShipped(orderId, { courierName: courierName.trim(), trackingNumber: trackingNumber.trim() }, shipKey.current),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["seller", "order", orderId] });
      void queryClient.invalidateQueries({ queryKey: escrowQueryKeys.forOrder(orderId) });
      showToast({ text: "Order marked as shipped" });
    },
    onError: (mutationError) => setError(mutationError instanceof WebappRequestError || !(mutationError instanceof Error) ? readErrorMessageForDisplay(mutationError) : mutationError.message),
  });
  if (order.isLoading) return <ListRowsSkeleton label="Loading order" rows={5} />;
  if (order.isError || !order.data) return <ErrorState description="We couldn't load this order." error={order.error} onRetry={() => void order.refetch()} />;
  const data = order.data;
  const escrow = escrowQuery.data;
  const fundsHeld = ["paid", "shipped", "delivered", "disputed"].includes(data.status);
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{data.reference}</h1>
      <div className={styles.grid}>
        <div className={styles.card}>
          <span className={styles.label}>Status</span>
          <span className={styles.value}>{data.status}</span>
        </div>
        <div className={styles.card}>
          <span className={styles.label}>Total</span>
          <span className={styles.value}>{formatMoneyForDisplay(data.total)}</span>
        </div>
      </div>
      {escrow ? (
        <section className={styles.section} aria-label="Payment protection">
          <EscrowSummaryCard escrow={escrow} viewerRole="seller" />
          {fundsHeld ? (
            <p className={styles.rowMeta}>
              <strong>Funds held in escrow until the buyer confirms. </strong>
              {data.status === "disputed"
                ? "The buyer opened a dispute, so the release is paused. Respond quickly to resolve it."
                : escrow.expectedReleaseAt
                  ? `Expected release to your wallet: ${formatFriendlyDate(escrow.expectedReleaseAt)} (or sooner if the buyer confirms).`
                  : "Ship the order to start the release countdown."}
            </p>
          ) : null}
          {escrow.disputeId ? <Link className={styles.primary} href={`/disputes/${encodeURIComponent(escrow.disputeId)}`}>View dispute</Link> : null}
          <h2 className={styles.sectionTitle}>Progress</h2>
          <EscrowTimeline escrow={escrow} viewerRole="seller" />
        </section>
      ) : null}
      <section className={styles.section} aria-label="Items">
        <h2 className={styles.sectionTitle}>Items</h2>
        <ul className={styles.list}>
          {data.items.map((item) => (
            <li key={item.id} className={styles.row}>
              <span className={styles.rowMain}>
                <span className={styles.rowTitle}>{item.product.name}</span>
                <span className={styles.rowMeta}>Qty {item.quantity}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section className={styles.section} aria-label="Fulfilment">
        <h2 className={styles.sectionTitle}>Mark as shipped</h2>
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            if (!ship.isPending) ship.mutate();
          }}
        >
          <label className={styles.field}>Courier
            <input className={styles.input} value={courierName} onChange={(event) => setCourierName(event.target.value)} required />
          </label>
          <label className={styles.field}>Tracking number
            <input className={styles.input} value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} required />
          </label>
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
          <button type="submit" className={styles.primary} disabled={ship.isPending}>{ship.isPending ? "Saving…" : "Mark as shipped"}</button>
        </form>
      </section>
    </div>
  );
}
