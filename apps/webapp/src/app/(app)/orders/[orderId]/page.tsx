"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";

import { Badge, ErrorState } from "@/components/ui/feedback";
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
import type { DeliveryStatus, OrderStatus } from "@/types";
import { canConfirmOrderReceipt, orderProgressSteps, resolveOrderProgress } from "@nantty/contracts";

import styles from "./page.module.css";
import { DetailSkeleton } from "@/components/ui/pageSkeletons";
import { ReturnRequestForm } from "@/components/order/returnRequestForm";
import { MessageStoreButton } from "@/components/messages/messageStoreButton";
import { buildSafePhoneLink } from "@/utils/phoneLink.util";

const statusTone: Record<OrderStatus, "neutral" | "brand" | "success" | "warning" | "error"> = {
  pending: "warning",
  paid: "brand",
  new: "brand",
  processing: "brand",
  ready: "brand",
  shipped: "brand",
  delivered: "success",
  completed: "success",
  cancelled: "error",
  returned: "error",
  refunded: "error",
  disputed: "error",
};

const deliveryStatusPresentation: Record<DeliveryStatus, { readonly label: string; readonly tone: "neutral" | "brand" | "success" | "warning" | "error" }> = {
  pending: { label: "Pending", tone: "neutral" },
  preparing: { label: "Preparing", tone: "brand" },
  ready_for_pickup: { label: "Ready to ship", tone: "brand" },
  in_transit: { label: "On the way", tone: "brand" },
  delivered: { label: "Delivered", tone: "success" },
  failed: { label: "Delivery attempt failed", tone: "error" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  returned: { label: "Returned", tone: "warning" },
};

const buyerCancellableStatuses = new Set(["pending", "new"]);

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

  const returnRequests = useQuery({
    queryKey: ["returns", "mine", orderId, 100],
    queryFn: () => ordersService.fetchMyReturnsPage(100, orderId),
    enabled: orderQuery.data?.status === "delivered" || orderQuery.data?.status === "completed",
  });
  const requestReturn = useMutation({
    mutationFn: (input: Parameters<typeof ordersService.requestReturn>[1]) => ordersService.requestReturn(orderId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["returns", "mine"] });
    },
  });

  const isDirectOrder = orderQuery.data?.paymentMode === "direct";
  const escrowQuery = useQuery({
    queryKey: escrowQueryKeys.forOrder(orderId),
    queryFn: () => escrowsService.fetchEscrowForOrder(orderId),
    enabled: orderQuery.isSuccess && !isDirectOrder && orderQuery.data?.status !== "pending",
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
    return <ErrorState title="Order not found" description="This order may belong to another account." error={orderQuery.error} onRetry={() => void orderQuery.refetch()} />;
  }

  const order = orderQuery.data;
  const isDirect = order.paymentMode === "direct";
  const orderProgress = resolveOrderProgress(order.status, order.timeline);
  const riderPhoneLink = order.delivery?.riderPhone ? buildSafePhoneLink(order.delivery.riderPhone) : null;

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

      {order.promotionIssue ? (
        <p className={styles.notice} role="status">
          {order.promotionIssue.message} No discount was applied to this store, and the order was placed at the normal price.
        </p>
      ) : null}

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Progress</h2>
        <ol className={styles.timeline}>
          {orderProgress.currentIndex !== null ? orderProgressSteps.map((label, index) => {
            const state = orderProgress.terminalMessage
              ? index <= orderProgress.currentIndex! ? "done" : "blocked"
              : index < orderProgress.currentIndex! ? "done" : index === orderProgress.currentIndex ? "current" : "todo";
            return (
              <li key={label} className={styles.timelineStep} data-state={state}>
                <span className={styles.timelineMarker} aria-hidden="true" />
                <span className={styles.timelineLabel}>{isDirect && label === "Payment confirmed" ? "Paid to seller" : label}</span>
              </li>
            );
          }) : null}
        </ol>
        {orderProgress.terminalMessage ? <p className={styles.escrowNote} role="status">{orderProgress.terminalMessage}</p> : null}
        <p className={styles.escrowNote}>
          {isDirect
            ? `Paid directly: ${order.store.name} was paid right away. For a refund, contact the seller or support.`
            : "Protected by Nantty Escrow: your money is held until you confirm delivery. You can open a dispute if something is wrong."}
        </p>
        {isDirect ? <p className={styles.escrowNote}>{ESCROW_REGION_NOTE}</p> : (
          <Link href={`/orders/${encodeURIComponent(order.id)}/escrow`} className={styles.escrowNote}>View payment protection</Link>
        )}
        {order.escrowReleaseAt && !isDirect ? <p className={styles.escrowNote}>Escrow releases to the seller on {new Date(order.escrowReleaseAt).toLocaleDateString()}.</p> : null}
        {order.escrowReleaseAt && isDirect && order.status === "delivered" ? <p className={styles.escrowNote}>This order completes automatically on {new Date(order.escrowReleaseAt).toLocaleDateString()} unless you ask for a return or refund.</p> : null}
      </section>

      {order.delivery ? (
        <section className={styles.panel} aria-labelledby="delivery-title">
          <div className={styles.deliveryHeader}>
            <h2 className={styles.panelTitle} id="delivery-title">Delivery</h2>
            <Badge tone={deliveryStatusPresentation[order.delivery.status].tone}>{deliveryStatusPresentation[order.delivery.status].label}</Badge>
          </div>
          <dl className={styles.deliveryFacts}>
            {order.shipment?.courierName ? (
              <div className={styles.deliveryFact}>
                <dt>Courier</dt>
                <dd>{order.shipment.courierName}</dd>
              </div>
            ) : null}
            {order.shipment?.trackingNumber ? (
              <div className={styles.deliveryFact}>
                <dt>Tracking</dt>
                <dd>{order.shipment.trackingNumber}</dd>
              </div>
            ) : null}
            {order.delivery.riderName || order.delivery.riderPhone ? (
              <div className={styles.deliveryFact}>
                <dt>Rider</dt>
                <dd>
                  {order.delivery.riderName ?? "Assigned"}
                  {order.delivery.riderPhone ? <> · {riderPhoneLink ? <a href={riderPhoneLink}>{order.delivery.riderPhone}</a> : order.delivery.riderPhone}</> : null}
                </dd>
              </div>
            ) : null}
            {order.delivery.estimatedDeliveryAt ? (
              <div className={styles.deliveryFact}>
                <dt>Estimated delivery</dt>
                <dd>{new Date(order.delivery.estimatedDeliveryAt).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</dd>
              </div>
            ) : null}
            {order.delivery.attempts > 0 ? (
              <div className={styles.deliveryFact}>
                <dt>Delivery attempts</dt>
                <dd>{order.delivery.attempts}</dd>
              </div>
            ) : null}
          </dl>
          <p className={styles.escrowNote}>Delivery updates are shown here in Nantty. Tracking details are provided by the seller; live courier tracking may not be available.</p>
          {order.delivery.lastAttemptNote ? <p className={styles.deliveryNote}>Last attempt: {order.delivery.lastAttemptNote}</p> : null}
          {order.delivery.status === "failed" ? <p className={styles.deliveryNote}>The seller will try again. Contact them if your address or phone number has changed.</p> : null}
        </section>
      ) : null}

      <section className={styles.panel} aria-labelledby="order-contact-title">
        <h2 className={styles.panelTitle} id="order-contact-title">Need help with this order?</h2>
        <p className={styles.escrowNote}>Message the store about this order. For account or payment issues, contact support below.</p>
        <MessageStoreButton storeId={order.store.id} storeName={order.store.name} label="Contact seller" />
      </section>

      {order.timeline?.length ? (
        <section className={styles.panel} aria-labelledby="order-updates-title">
          <h2 className={styles.panelTitle} id="order-updates-title">Order updates</h2>
          <ol className={styles.eventList}>
            {[...order.timeline].slice(-8).reverse().map((event) => (
              <li key={event.id} className={styles.event}>
                <strong>{event.summary}</strong>
                <time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time>
              </li>
            ))}
          </ol>
          <p className={styles.escrowNote}>Updates are recorded by Nantty from seller order actions. Live courier tracking may not be available.</p>
        </section>
      ) : null}

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

      {canConfirmOrderReceipt(order.status) ? (
        <Button size="lg" busy={confirmReceipt.isPending} onClick={() => confirmReceipt.mutate()}>
          Confirm delivery
        </Button>
      ) : null}
      {order.status === "delivered" || order.status === "completed" ? (
        <ReturnRequestForm
          items={order.items}
          knownRequest={returnRequests.data?.data.find((request) => request.orderId === orderId)}
          submittedRequest={requestReturn.data}
          submitting={requestReturn.isPending}
          errorMessage={requestReturn.isError ? readErrorMessageForDisplay(requestReturn.error) : null}
          onSubmit={(input) => requestReturn.mutate(input)}
        />
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
