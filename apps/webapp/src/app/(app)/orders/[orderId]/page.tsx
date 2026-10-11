"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";

import { Badge, ErrorState } from "@/components/ui/feedback";
import { RetryButton } from "@/components/ui/controls";
import { Button } from "@/components/ui/button";
import { requestConfirmation } from "@/components/ui/confirmDialog";
import { MediaImage } from "@/components/ui/media";
import { ESCROW_REGION_NOTE } from "@/components/escrow/escrowCards";
import { escrowQueryKeys, escrowsService } from "@/services/disputes.service";
import { ordersService } from "@/services/orders.service";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { paymentsService } from "@/services/payments.service";
import { openHostedCheckout } from "@/utils/hostedCheckout.util";
import { forgetPendingOrderPayment, readPendingOrderPayment, rememberPendingOrderPayment, type PendingOrderPayment } from "@/utils/paymentReturn.util";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatTimeSincePosted } from "@/utils/formatDate.util";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";
import { isOrderReviewable } from "@/utils/productReviews.util";
import type { OrderStatus } from "@/types";

import styles from "./page.module.css";
import { DetailSkeleton } from "@/components/ui/pageSkeletons";

const statusTone: Record<OrderStatus, "neutral" | "brand" | "success" | "warning" | "error"> = {
  pending: "warning",
  paid: "brand",
  shipped: "brand",
  delivered: "success",
  completed: "success",
  cancelled: "error",
  disputed: "error",
};

const buyerCancellableStatuses = new Set(["pending", "new"]);

const statusSteps: readonly { readonly status: OrderStatus; readonly label: string }[] = [
  { status: "pending", label: "Order placed" },
  { status: "paid", label: "Paid" },
  { status: "shipped", label: "Shipped" },
  { status: "delivered", label: "Delivered" },
  { status: "completed", label: "Completed" },
];

export default function OrderDetailPage({ params }: { readonly params: Promise<{ readonly orderId: string }> }) {
  const { orderId } = use(params);
  const queryClient = useQueryClient();
  const [pendingPayment, setPendingPayment] = useState<PendingOrderPayment | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => setPendingPayment(readPendingOrderPayment(orderId)), [orderId]);

  const orderQuery = useQuery({
    queryKey: ["orders", "detail", orderId],
    queryFn: () => ordersService.fetchOrderById(orderId),
    retry: false,
  });

  const isDirectOrder = orderQuery.data?.paymentMode === "direct";
  const escrowQuery = useQuery({
    queryKey: escrowQueryKeys.forOrder(orderId),
    queryFn: () => escrowsService.fetchEscrowForOrder(orderId),
    enabled: orderQuery.isSuccess && !isDirectOrder,
    retry: false,
  });

  const verifyPayment = useMutation({
    mutationFn: () => paymentsService.verifyOrderPayment(orderId),
    onSuccess: async (result) => {
      if (result.status === "paid" || result.status === "failed") {
        forgetPendingOrderPayment();
        setPendingPayment(null);
        await queryClient.invalidateQueries({ queryKey: ["orders"] });
        setNotice(result.status === "paid" ? "Payment confirmed. Your order is on its way to the seller." : "That payment didn't go through. Try again.");
      } else {
        setNotice("Still waiting for our payment partner to confirm. Check again in a moment. You won't be charged twice.");
      }
    },
    onError: (error) => setNotice(readErrorMessageForDisplay(error)),
  });

  const resumePayment = useMutation({
    mutationFn: async () => {
      if (pendingPayment?.checkoutUrl) return { orderId, reference: pendingPayment.reference, checkoutUrl: pendingPayment.checkoutUrl, authorizationUrl: pendingPayment.checkoutUrl };
      const payment = await paymentsService.initializeOrderPayment(orderId, `pay-${orderId}`);
      rememberPendingOrderPayment({ orderId, reference: payment.reference, checkoutUrl: payment.checkoutUrl || payment.authorizationUrl });
      return payment;
    },
    onSuccess: (payment) => {
      if (openHostedCheckout(payment) === "blocked") setNotice("We couldn't open the secure payment page. Try again in a moment.");
    },
    onError: (error) => setNotice(readErrorMessageForDisplay(error)),
  });

  const confirmReceipt = useMutation({
    mutationFn: () => ordersService.confirmOrderReceipt(orderId, `confirm-${orderId}`),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  const cancelOrder = useMutation({
    mutationFn: () => ordersService.cancelMyOrder(orderId, `cancel-${orderId}`),
    onSuccess: () => setNotice("Your order is cancelled. Any payment held in escrow is returned to you."),
    onError: (error) => setNotice(readErrorMessageForDisplay(error)),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  async function confirmAndCancelOrder() {
    if (cancelOrder.isPending) return;
    const confirmed = await requestConfirmation({ title: "Cancel this order?", description: "The seller won't ship it. Any payment held in escrow is returned to you.", confirmLabel: "Cancel order", cancelLabel: "Keep order", tone: "danger", intent: "cancel" });
    if (confirmed) cancelOrder.mutate();
  }

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

      {pendingPayment || order.status === "pending" ? (
        <section className={styles.paymentBanner}>
          <div>
            <h2 className={styles.paymentTitle}>Complete your payment</h2>
            <p className={styles.paymentBody}>
              {pendingPayment ? <>Reference <strong>{pendingPayment.reference}</strong> is waiting. </> : null}
              If you closed the payment page, open it again or check whether the payment already went through.
            </p>
          </div>
          <div className={styles.paymentActions}>
            <Button busy={resumePayment.isPending} disabled={resumePayment.isSuccess} onClick={() => resumePayment.mutate()}>
              Pay securely
            </Button>
            <Button variant="secondary" busy={verifyPayment.isPending} onClick={() => verifyPayment.mutate()}>
              Check payment
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
            ? `Paid directly: ${order.store.name} was paid right away. For a refund, contact the seller or support.`
            : "Protected by Zudomart Escrow: your money is held until you confirm delivery. You can open a dispute if something is wrong."}
        </p>
        {isDirect ? <p className={styles.escrowNote}>{ESCROW_REGION_NOTE}</p> : (
          <Link href={`/orders/${encodeURIComponent(order.id)}/escrow`} className={styles.escrowNote}>View payment protection</Link>
        )}
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
                {isOrderReviewable(order) ? (
                  <Link href={`/product/${encodeURIComponent(item.product.id)}/review`} className={styles.itemVariant}>Write a review</Link>
                ) : null}
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
      {order.fulfilmentStatus && buyerCancellableStatuses.has(order.fulfilmentStatus) ? (
        <div className={styles.escrowNote}>
          <p>You can cancel until the seller starts preparing your order. After that, ask the seller or open a dispute.</p>
          <Button variant="secondary" busy={cancelOrder.isPending} onClick={() => void confirmAndCancelOrder()}>
            Cancel order
          </Button>
        </div>
      ) : null}
      {escrowQuery.data?.disputeId ? (
        <Link href={`/disputes/${encodeURIComponent(escrowQuery.data.disputeId)}`}>View dispute</Link>
      ) : !isDirect && escrowQuery.data && (order.status === "paid" || order.status === "shipped" || order.status === "delivered") ? (
        <Link href={`/orders/${encodeURIComponent(order.id)}/dispute`}>Open a dispute</Link>
      ) : null}
      <Link href={`/help/tickets/new?category=order&linkKind=order&linkId=${encodeURIComponent(order.id)}&linkLabel=${encodeURIComponent(`Order ${order.reference}`)}`}>Get help with this order</Link>
    </div>
  );
}
