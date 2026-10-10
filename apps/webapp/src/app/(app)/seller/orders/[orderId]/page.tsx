"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { RetryButton } from "@/components/ui/controls";
import { ErrorState } from "@/components/ui/feedback";
import { ListRowsSkeleton } from "@/components/ui/pageSkeletons";
import { showToast } from "@/components/ui/toast";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { sellerService } from "@/services/seller.service";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

import styles from "../../page.module.css";

export default function SellerOrderDetailPage() {
  const params = useParams<{ orderId: string }>();
  const orderId = params.orderId;
  const queryClient = useQueryClient();
  const order = useQuery({ queryKey: ["seller", "order", orderId], queryFn: () => sellerService.fetchStoreOrderById(orderId) });
  const [courierName, setCourierName] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const ship = useMutation({
    mutationFn: () => sellerService.markStoreOrderAsShipped(orderId, { courierName: courierName.trim(), trackingNumber: trackingNumber.trim() }),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["seller", "order", orderId] });
      showToast({ text: "Order marked as shipped" });
    },
    onError: (mutationError) => setError(readErrorMessageForDisplay(mutationError)),
  });
  if (order.isLoading) return <ListRowsSkeleton label="Loading order" rows={5} />;
  if (order.isError || !order.data) return <ErrorState description="We couldn't load this order." action={<RetryButton onRetry={() => order.refetch()} />} />;
  const data = order.data;
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
            ship.mutate();
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
