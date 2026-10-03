"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { OrderCancelDialog } from "@/components/orders/orderCancelDialog";
import { OrderNextStepPanel } from "@/components/orders/orderNextStepPanel";
import { OrderPaymentPanels } from "@/components/orders/orderPaymentPanels";
import { deliveryStatusPresentation, orderStatusPresentation } from "@/components/orders/orderPresentation.constant";
import { OrderShippingSnapshotPanel } from "@/components/orders/orderShippingSnapshotPanel";
import { OrderRefundDialog } from "@/components/orders/orderRefundDialog";
import { OrderNotesPanel, OrderTimelinePanel } from "@/components/orders/orderTimelinePanel";
import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { Button, ButtonLink } from "@/components/ui/button";
import { Callout, LoadingBlock } from "@/components/ui/feedback";
import { KeyValueList, PageHeader, PageStack, Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useToast } from "@/components/ui/toastProvider";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { useStoreContext } from "@/hooks/useStoreSettings.hook";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { Conversation } from "@/types/conversation.type";
import type { OnlineOrder } from "@/types/order.type";
import { formatDateTimeForDisplay } from "@/utils/dateFormatting.util";

import styles from "./orders.module.css";
import { IconLabel } from "@/components/ui/zudoIcon";

const refundableStatuses = new Set(["processing", "ready", "shipped", "delivered", "completed", "returned"]);

export function OrderDetailView({ orderId }: { readonly orderId: string }) {
  const router = useRouter();
  const { can } = useSellerSession();
  const { showToast } = useToast();
  const { formatMoney } = useMoneyFormatter();
  const { locations } = useStoreContext();
  const orderQuery = useSellerQuery<OnlineOrder>(`/seller/orders/${encodeURIComponent(orderId)}`);
  const [openDialog, setOpenDialog] = useState<"cancel" | "reject" | "refund" | null>(null);
  const [isOpeningConversation, setIsOpeningConversation] = useState(false);
  const order = orderQuery.data;

  if (orderQuery.isLoading && !order) return <LoadingBlock label="Loading order" />;
  if (!order) {
    return (
      <Callout tone="error" title="Order not available" action={<Button size="small" onClick={orderQuery.reload}>Try again</Button>}>
        {orderQuery.errorMessage ?? "This order could not be loaded."}
      </Callout>
    );
  }

  const canManageOrders = can("orders:manage");
  const canCancel = canManageOrders && (order.status === "processing" || order.status === "ready");
  const canRefund = canManageOrders && refundableStatuses.has(order.status) && order.total.amountMinor > order.refundedAmount.amountMinor;
  const replaceOrder = (updatedOrder: OnlineOrder) => orderQuery.replaceData(() => updatedOrder);

  async function openConversationWithCustomer() {
    if (!order) return;
    setIsOpeningConversation(true);
    try {
      const conversation = await sendSellerApiRequest<Conversation>(`/seller/orders/${order.id}/conversation`, { method: "POST" });
      router.push(`/messages?conversation=${encodeURIComponent(conversation.id)}`);
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
      setIsOpeningConversation(false);
    }
  }

  return (
    <PageStack>
      <PageHeader
        eyebrow={<Link href="/orders"><IconLabel name="arrowLeft24" size={16}>Orders</IconLabel></Link>}
        title={`Order ${order.orderNumber}`}
        description={`Placed in the Zudomart app ${formatDateTimeForDisplay(order.createdAt)} by ${order.buyer.name} (@${order.buyer.username})`}
        actions={
          <div className={styles.headerActions}>
            <StatusBadge tone={orderStatusPresentation[order.status].tone}>{orderStatusPresentation[order.status].label}</StatusBadge>
            {can("messages:manage") ? (
              <Button size="small" iconName="chatCircle24" isBusy={isOpeningConversation} onClick={() => void openConversationWithCustomer()}>
                Contact customer
              </Button>
            ) : null}
            <ButtonLink href={`/orders/${order.id}/invoice`} iconName="export24" size="small">
              Invoice
            </ButtonLink>
            <ButtonLink href={`/orders/${order.id}/invoice?document=receipt`} size="small">
              Receipt
            </ButtonLink>
            <ButtonLink href={`/orders/${order.id}/packing-slip`} size="small">
              Packing slip
            </ButtonLink>
            {canRefund ? (
              <Button size="small" variant="ghost" onClick={() => setOpenDialog("refund")}>
                Refund
              </Button>
            ) : null}
            {canCancel ? (
              <Button size="small" variant="ghost" onClick={() => setOpenDialog("cancel")}>
                Cancel order
              </Button>
            ) : null}
          </div>
        }
      />
      {order.status === "disputed" ? (
        <Callout tone="error" title="The customer opened a dispute" action={<ButtonLink href="/orders/disputes" size="small">Respond</ButtonLink>}>
          Escrow is paused until Zudomart decides. Reply with photos and delivery proof from Disputes.
        </Callout>
      ) : null}
      <div className={styles.detailGrid}>
        <div className={styles.sideStack}>
          {canManageOrders ? <OrderNextStepPanel order={order} onOrderChanged={replaceOrder} onRejectRequested={() => setOpenDialog("reject")} /> : null}
          <Panel title={`Items (${order.lines.reduce((sum, line) => sum + line.quantity, 0)})`}>
            <ul>
              {order.lines.map((line) => (
                <li key={line.id} className={styles.lineItem}>
                  {line.imageUrl ? <img src={line.imageUrl} alt="" className={styles.thumbnail} loading="lazy" /> : <span className={styles.thumbnail} aria-hidden="true" />}
                  <span className={styles.primaryCell}>
                    <strong>{line.name}</strong>
                    <span className={styles.muted}>
                      {line.variantTitle} · SKU {line.sku} · {line.quantity} × {formatMoney(line.unitPrice)}
                    </span>
                  </span>
                  <span className={styles.amount}>{formatMoney(line.lineTotal)}</span>
                </li>
              ))}
            </ul>
          </Panel>
          <OrderTimelinePanel order={order} />
          <OrderNotesPanel order={order} canAddNotes={canManageOrders} onOrderChanged={replaceOrder} />
        </div>
        <div className={styles.sideStack}>
          <Panel title="Customer">
            <KeyValueList
              items={[
                { label: "Name", value: order.buyer.name },
                { label: "Zudomart", value: `@${order.buyer.username}` },
                { label: "Phone", value: order.buyer.phone ? <a href={`tel:${order.buyer.phone}`}>{order.buyer.phone}</a> : "—" },
              ]}
            />
          </Panel>
          <OrderPaymentPanels order={order} />
          <Panel title="Delivery" actions={<StatusBadge tone={deliveryStatusPresentation[order.delivery.status].tone}>{deliveryStatusPresentation[order.delivery.status].label}</StatusBadge>}>
            <address style={{ fontStyle: "normal", lineHeight: 1.6, marginBottom: 12 }}>
              <strong>{order.shippingAddress.recipientName}</strong>
              <br />
              {order.shippingAddress.line1}
              <br />
              {order.shippingAddress.city}, {order.shippingAddress.state}
              <br />
              {order.shippingAddress.phone}
            </address>
            <KeyValueList
              items={[
                { label: "Courier", value: order.fulfilment?.courier ?? "—" },
                { label: "Tracking", value: order.fulfilment ? (order.fulfilment.trackingUrl ? <a href={order.fulfilment.trackingUrl} target="_blank" rel="noopener noreferrer">{order.fulfilment.trackingNumber}</a> : order.fulfilment.trackingNumber) : "—" },
                { label: "Rider", value: order.delivery.riderName ? `${order.delivery.riderName}${order.delivery.riderPhone ? ` · ${order.delivery.riderPhone}` : ""}` : "—" },
                { label: "Ships from", value: locations.find((location) => location.id === order.fulfilment?.fromLocationId)?.name ?? "—" },
                { label: "Delivered", value: formatDateTimeForDisplay(order.deliveredAt) },
              ]}
            />
            {order.delivery.lastAttemptNote ? <p className={styles.muted}>Last attempt: {order.delivery.lastAttemptNote}</p> : null}
          </Panel>
          <OrderShippingSnapshotPanel orderId={order.id} />
          {order.attributedCreator ? (
            <Panel title="Sold by a creator">
              <p>@{order.attributedCreator.username} earns an affiliate commission on this order when escrow is released.</p>
            </Panel>
          ) : null}
        </div>
      </div>
      <OrderCancelDialog order={order} mode={openDialog === "reject" ? "reject" : "cancel"} isOpen={openDialog === "cancel" || openDialog === "reject"} onClose={() => setOpenDialog(null)} onCancelled={replaceOrder} />
      {openDialog === "refund" ? <OrderRefundDialog order={order} isOpen onClose={() => setOpenDialog(null)} onRefunded={replaceOrder} /> : null}
    </PageStack>
  );
}
