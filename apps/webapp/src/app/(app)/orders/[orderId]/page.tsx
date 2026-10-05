"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";

import { Badge, ErrorState } from "@/components/ui/feedback";
import { RetryButton } from "@/components/ui/controls";
import { Button } from "@/components/ui/button";
import { MediaImage } from "@/components/ui/media";
import { ordersService } from "@/services/orders.service";
import { readErrorMessageForDisplay, sendRequestToWebappServer } from "@/services/clientApi.service";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatTimeSincePosted } from "@/utils/formatDate.util";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";
import type { OrderStatus } from "@/types";

import styles from "./page.module.css";
import { DetailSkeleton } from "@/components/ui/pageSkeletons";

interface PendingPayment {
  readonly orderId: string;
  readonly authorizationUrl: string;
  readonly reference: string;
}

const statusTone: Record<OrderStatus, "neutral" | "brand" | "success" | "warning" | "error"> = {
  pending: "warning",
  paid: "brand",
  shipped: "brand",
  delivered: "success",
  completed: "success",
  cancelled: "error",
  disputed: "error",
};

const statusSteps: readonly { readonly status: OrderStatus; readonly label: string }[] = [
  { status: "pending", label: "Order placed" },
  { status: "paid", label: "Paid into escrow" },
  { status: "shipped", label: "Shipped" },
  { status: "delivered", label: "Delivered" },
  { status: "completed", label: "Completed" },
];

function readPendingPayment(orderId: string): PendingPayment | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem("zd_pending_payment");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingPayment;
    return parsed.orderId === orderId ? parsed : null;
  } catch {
    return null;
  }
}

export default function OrderDetailPage({ params }: { readonly params: Promise<{ readonly orderId: string }> }) {
  const { orderId } = use(params);
  const queryClient = useQueryClient();
  const [pendingPayment, setPendingPayment] = useState<PendingPayment | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => setPendingPayment(readPendingPayment(orderId)), [orderId]);

  const orderQuery = useQuery({
    queryKey: ["orders", "detail", orderId],
    queryFn: () => ordersService.fetchOrderById(orderId),
    retry: false,
  });

  const verifyPayment = useMutation({
    mutationFn: () => sendRequestToWebappServer<{ status: "pending" | "paid" | "failed" }>(`/api/v1/payments/orders/${orderId}/verify`, { method: "POST" }),
    onSuccess: async (result) => {
      if (result.status === "paid" || result.status === "failed") {
        sessionStorage.removeItem("zd_pending_payment");
        setPendingPayment(null);
        await queryClient.invalidateQueries({ queryKey: ["orders"] });
        setNotice(result.status === "paid" ? "Payment confirmed. Your order is on its way to the seller." : "That payment didn't go through. Try again.");
      } else {
        setNotice("Still waiting on the payment provider. Check again in a moment.");
      }
    },
    onError: (error) => setNotice(readErrorMessageForDisplay(error)),
  });

  const confirmReceipt = useMutation({
    mutationFn: () => ordersService.confirmOrderReceipt(orderId, `confirm-${orderId}`),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  if (orderQuery.isLoading) return <DetailSkeleton label="Loading order" blocks={3} />;
  if (orderQuery.isError || !orderQuery.data) {
    return <ErrorState title="Order not found" description="This order may belong to another account." action={<RetryButton onRetry={() => orderQuery.refetch()} />} />;
  }

  const order = orderQuery.data;
  const isDirect = order.paymentMode === "direct";
  const activeStepIndex = statusSteps.findIndex((step) => step.status === order.status);

  return (
    <div className={styles.page}>
      <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
        <Link href="/orders">Orders</Link>
        <span aria-hidden="true">/</span>
        <span>{order.reference}</span>
      </nav>

      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{order.reference}</h1>
          <p className={styles.subtitle}>
            {order.store.name} · {formatTimeSincePosted(order.createdAt)}
          </p>
        </div>
        <Badge tone={statusTone[order.status]}>{order.status}</Badge>
      </header>

      {pendingPayment ? (
        <section className={styles.paymentBanner}>
          <div>
            <h2 className={styles.paymentTitle}>Complete your payment</h2>
            <p className={styles.paymentBody}>
              Reference <strong>{pendingPayment.reference}</strong> is waiting. Finish checkout in the secure window, then check back here.
            </p>
          </div>
          <div className={styles.paymentActions}>
            <a href={pendingPayment.authorizationUrl} target="_blank" rel="noopener noreferrer" className={styles.payLink}>
              Open secure checkout
            </a>
            <Button variant="secondary" busy={verifyPayment.isPending} onClick={() => verifyPayment.mutate()}>
              I&apos;ve paid — check status
            </Button>
          </div>
        </section>
      ) : null}

      {notice ? (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      ) : null}

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Progress</h2>
        <ol className={styles.timeline}>
          {statusSteps.map((step, index) => {
            const state = order.status === "cancelled" || order.status === "disputed" ? (index <= 0 ? "done" : "blocked") : index < activeStepIndex ? "done" : index === activeStepIndex ? "current" : "todo";
            return (
              <li key={step.status} className={styles.timelineStep} data-state={state}>
                <span className={styles.timelineMarker} aria-hidden="true" />
                <span className={styles.timelineLabel}>{isDirect && step.status === "paid" ? "Paid to seller" : step.label}</span>
              </li>
            );
          })}
        </ol>
        <p className={styles.escrowNote}>
          {isDirect
            ? "Paid directly: the seller was paid right away. For a refund, ask the seller or contact support."
            : "Protected by Zudomart Escrow: your money is held until you confirm delivery. You can open a dispute if something is wrong."}
        </p>
        {order.escrowReleaseAt && !isDirect ? <p className={styles.escrowNote}>Escrow releases to the seller on {new Date(order.escrowReleaseAt).toLocaleDateString()}.</p> : null}
      </section>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Items</h2>
        <ul className={styles.itemList}>
          {order.items.map((item) => (
            <li key={item.id} className={styles.item}>
              <span className={styles.itemThumb}>
                <MediaImage src={item.product.imageUrl} alt="" sizes="64px" />
              </span>
              <span className={styles.itemBody}>
                <Link href={`/product/${item.product.id}`} className={styles.itemName}>
                  {item.product.name}
                </Link>
                {item.variant ? <span className={styles.itemVariant}>{item.variant}</span> : null}
              </span>
              <span className={styles.itemQty}>× {item.quantity}</span>
              <span className={styles.itemPrice}>{formatMoneyForDisplay(item.product.price)}</span>
            </li>
          ))}
        </ul>
        <div className={styles.totalRow}>
          <span>Total</span>
          <span>{formatMoneyForDisplay(order.total)}</span>
        </div>
      </section>

      {order.status === "delivered" ? (
        <Button size="lg" busy={confirmReceipt.isPending} onClick={() => confirmReceipt.mutate()}>
          Confirm delivery
        </Button>
      ) : null}
      <Link href={`/help/tickets/new?category=order&linkKind=order&linkId=${encodeURIComponent(order.id)}&linkLabel=${encodeURIComponent(`Order ${order.reference}`)}`}>Get help with this order</Link>
    </div>
  );
}
