"use client";

import Link from "next/link";
import { useState } from "react";

import { OrderCancelDialog } from "@/components/orders/orderCancelDialog";
import { OrderFulfilmentForm } from "@/components/orders/orderFulfilmentForm";
import { escrowStatusPresentation, orderStatusPresentation } from "@/components/orders/orderPresentation.constant";
import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { Button, ButtonLink } from "@/components/ui/button";
import { Callout, LoadingBlock } from "@/components/ui/feedback";
import { KeyValueList, PageHeader, PageStack, Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { useStoreContext } from "@/hooks/useStoreSettings.hook";
import type { OnlineOrder } from "@/types/order.type";
import { formatDateForDisplay, formatDateTimeForDisplay } from "@/utils/dateFormatting.util";

import styles from "./orders.module.css";

export function OrderDetailView({ orderId }: { readonly orderId: string }) {
  const { can } = useSellerSession();
  const { formatMoney } = useMoneyFormatter();
  const { locations } = useStoreContext();
  const orderQuery = useSellerQuery<OnlineOrder>(`/seller/orders/${encodeURIComponent(orderId)}`);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const order = orderQuery.data;

  if (orderQuery.isLoading && !order) return <LoadingBlock label="Loading order" />;
  if (!order) return <Callout tone="error" title="Order not available">{orderQuery.errorMessage ?? "This order could not be loaded."}</Callout>;

  const canManageOrders = can("orders:manage");
  const isAwaitingShipment = order.status === "paid" || order.status === "processing";
  const escrow = escrowStatusPresentation[order.escrowStatus];
  const replaceOrder = (updatedOrder: OnlineOrder) => orderQuery.replaceData(() => updatedOrder);

  return (
    <PageStack>
      <PageHeader
        eyebrow={<Link href="/orders">← Orders</Link>}
        title={`Order ${order.orderNumber}`}
        description={`Placed ${formatDateTimeForDisplay(order.createdAt)} by ${order.buyer.name} (@${order.buyer.username})`}
        actions={
          <>
            <StatusBadge tone={orderStatusPresentation[order.status].tone}>{orderStatusPresentation[order.status].label}</StatusBadge>
            <ButtonLink href={`/orders/${order.id}/packing-slip`} iconName="export24" size="small">
              Packing slip
            </ButtonLink>
            {canManageOrders && isAwaitingShipment ? (
              <Button size="small" variant="ghost" onClick={() => setIsCancelDialogOpen(true)}>
                Cancel order
              </Button>
            ) : null}
          </>
        }
      />
      <div className={styles.detailGrid}>
        <div className={styles.sideStack}>
          {isAwaitingShipment && canManageOrders ? (
            <Panel title="Ship this order" description="Pack the items below, hand them to a courier, then add the tracking details. The buyer is notified straight away.">
              <OrderFulfilmentForm order={order} onShipped={replaceOrder} />
            </Panel>
          ) : null}
          {order.fulfilment ? (
            <Panel title="Shipping">
              <KeyValueList
                items={[
                  { label: "Courier", value: order.fulfilment.courier },
                  { label: "Tracking number", value: order.fulfilment.trackingUrl ? <a href={order.fulfilment.trackingUrl} target="_blank" rel="noopener noreferrer">{order.fulfilment.trackingNumber}</a> : order.fulfilment.trackingNumber },
                  { label: "Shipped", value: formatDateTimeForDisplay(order.fulfilment.shippedAt) },
                  { label: "From", value: locations.find((location) => location.id === order.fulfilment?.fromLocationId)?.name ?? "—" },
                  { label: "Delivered", value: formatDateTimeForDisplay(order.deliveredAt) },
                ]}
              />
            </Panel>
          ) : null}
          <Panel title={`Items (${order.lines.reduce((sum, line) => sum + line.quantity, 0)})`}>
            <ul>
              {order.lines.map((line) => (
                <li key={line.id} className={styles.lineItem}>
                  {line.imageUrl ? <img src={line.imageUrl} alt="" className={styles.thumbnail} loading="lazy" /> : <span className={styles.thumbnail} aria-hidden="true" />}
                  <span className={styles.primaryCell}>
                    <strong>{line.name}</strong>
                    <span className={styles.muted}>{line.variantTitle} · SKU {line.sku} · {line.quantity} × {formatMoney(line.unitPrice)}</span>
                  </span>
                  <span className={styles.amount}>{formatMoney(line.lineTotal)}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
        <div className={styles.sideStack}>
          <Panel title="Payment">
            <KeyValueList
              items={[
                { label: "Items", value: formatMoney(order.subtotal) },
                { label: "Delivery", value: formatMoney(order.shippingFee) },
                { label: "Buyer paid", value: formatMoney(order.total) },
                { label: "Your payout", value: formatMoney(order.sellerPayout) },
              ]}
            />
          </Panel>
          <Panel title="Escrow" actions={<StatusBadge tone={escrow.tone}>{escrow.label}</StatusBadge>}>
            <p>{escrow.explanation}</p>
            {order.escrowReleaseAt ? <p className={styles.muted}>Releases automatically on {formatDateForDisplay(order.escrowReleaseAt)} if the buyer does not raise a problem.</p> : null}
          </Panel>
          <Panel title="Deliver to">
            <address style={{ fontStyle: "normal", lineHeight: 1.6 }}>
              <strong>{order.shippingAddress.recipientName}</strong>
              <br />
              {order.shippingAddress.line1}
              <br />
              {order.shippingAddress.city}, {order.shippingAddress.state}
              <br />
              {order.shippingAddress.phone}
            </address>
          </Panel>
          {order.attributedCreator ? (
            <Panel title="Sold by a creator">
              <p>@{order.attributedCreator.username} earns an affiliate commission on this order when escrow is released.</p>
            </Panel>
          ) : null}
        </div>
      </div>
      <OrderCancelDialog order={order} isOpen={isCancelDialogOpen} onClose={() => setIsCancelDialogOpen(false)} onCancelled={replaceOrder} />
    </PageStack>
  );
}
