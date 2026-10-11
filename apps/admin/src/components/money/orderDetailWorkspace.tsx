"use client";

import Link from "next/link";
import { useState } from "react";

import { useAdminPermissions } from "@/components/session/adminSessionProvider";
import { Button, ButtonLink } from "@/components/ui/button";
import { ErrorBlock, LoadingBlock } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/pageHeader";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Card, KeyValueList, TwoColumnLayout } from "@/components/ui/surfaces";
import { UserIdentity } from "@/components/ui/userIdentity";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchOrderDetail } from "@/services/moneyApi.service";
import type { OrderDetail } from "@/types/commerce.type";
import { formatDateTime, formatMoneyForDisplay, humanizeConstantName } from "@/utils/formatting.util";

import { EscrowSummary, OrderTimeline } from "./escrowTimeline";
import { IssueRefundDialog } from "./issueRefundDialog";
import styles from "./money.module.css";
import { RefundsTable } from "./refundsTable";

function OrderItemsCard({ order }: { readonly order: OrderDetail }) {
  return (
    <Card title={`Items (${order.itemCount})`}>
      <ul className={styles.items}>
        {order.items.map((item) => (
          <li key={item.id}>
            {item.imageUrl ? <img src={item.imageUrl} alt="" className={styles.thumbnail} referrerPolicy="no-referrer" loading="lazy" /> : <span className={styles.thumbnail} />}
            <span className={styles.stack}>
              <strong>{item.productName}</strong>
              <span className={styles.muted}>
                {item.variant ? `${item.variant} · ` : ""}{item.quantity} × {formatMoneyForDisplay(item.unitPrice)}{item.attribution ? ` · via ${humanizeConstantName(item.attribution.source)}` : ""}
              </span>
            </span>
            <span className={styles.amount}>{formatMoneyForDisplay(item.lineTotal)}</span>
          </li>
        ))}
      </ul>
      <dl className={styles.totals}>
        <dt>Subtotal</dt>
        <dd>{formatMoneyForDisplay(order.subtotal)}</dd>
        {order.discount.amountMinor > 0 ? <><dt>Discount</dt><dd>−{formatMoneyForDisplay(order.discount)}</dd></> : null}
        {order.storeCredit.amountMinor > 0 ? <><dt>Store credit</dt><dd>−{formatMoneyForDisplay(order.storeCredit)}</dd></> : null}
        <dt>Delivery</dt>
        <dd>{formatMoneyForDisplay(order.deliveryFee)}</dd>
        <dt className={styles.grandTotal}>Buyer paid</dt>
        <dd className={styles.grandTotal}>{formatMoneyForDisplay(order.total)}</dd>
        <dt>Refunded</dt>
        <dd>{formatMoneyForDisplay(order.refundedTotal)}</dd>
      </dl>
    </Card>
  );
}

export function OrderDetailWorkspace({ orderId }: { readonly orderId: string }) {
  const { can } = useAdminPermissions();
  const { data: order, errorMessage, isLoading, reload } = useAdminQuery((signal) => fetchOrderDetail(orderId, signal), orderId);
  const [isRefundDialogOpen, setIsRefundDialogOpen] = useState(false);

  if (errorMessage) return <ErrorBlock variant="section" message={errorMessage} onRetry={reload} />;
  if (isLoading || !order) return <LoadingBlock lines={8} />;
  const canRefund = can("refunds:issue") && order.refundable.amountMinor > 0 && order.status !== "disputed";

  return (
    <>
      <PageHeader
        area="Money · Orders"
        title={<span className="mono">{order.orderNumber}</span>}
        description={`${order.storeName || "Store"} · placed ${formatDateTime(order.placedAt)} · delivering to ${[order.deliveryCity, order.deliveryState].filter(Boolean).join(", ") || "—"}`}
        meta={
          <>
            <StatusBadge status={order.status} />
            <StatusBadge status={order.paymentStatus} hasDot={false} />
            {order.deliveryStatus ? <StatusBadge status={order.deliveryStatus} hasDot={false} /> : null}
          </>
        }
        actions={
          <>
            <ButtonLink href="/commerce/orders" variant="ghost" iconName="arrowLeft24">All orders</ButtonLink>
            {order.status === "disputed" && can("disputes:resolve") ? <ButtonLink href="/commerce/disputes" iconName="chatCircle24">Disputes</ButtonLink> : null}
            {canRefund ? <Button variant="quietDanger" iconName="arrowLeft24" onClick={() => setIsRefundDialogOpen(true)}>Issue refund</Button> : null}
          </>
        }
      />
      <TwoColumnLayout
        main={
          <>
            <OrderItemsCard order={order} />
            <Card title="Escrow">
              <EscrowSummary escrow={order.escrow} />
            </Card>
            <Card title="Timeline">
              <OrderTimeline events={order.timeline} />
            </Card>
            <Card title="Refunds" isFlush>
              <RefundsTable refunds={order.refunds} emptyMessage="No refunds on this order." />
            </Card>
          </>
        }
        aside={
          <>
            <Card title="People">
              <KeyValueList
                items={[
                  { label: "Buyer", value: <Link href={`/users/${order.buyer.id}`}><UserIdentity user={order.buyer} size={24} /></Link> },
                  { label: "Seller", value: <Link href={`/users/${order.seller.id}`}><UserIdentity user={order.seller} size={24} /></Link> },
                ]}
              />
            </Card>
            <Card title="Payment and delivery">
              <KeyValueList
                items={[
                  { label: "Invoice", value: order.invoiceNumber || "—", isMono: true },
                  { label: "Payment", value: `${humanizeConstantName(order.paymentStatus)} · ${humanizeConstantName(order.paymentMode)}` },
                  { label: "Delivery", value: order.deliveryStatus ? humanizeConstantName(order.deliveryStatus) : "—" },
                  { label: "Courier", value: order.courier ?? "Not shipped yet" },
                  { label: "Tracking", value: order.trackingNumber ?? "—", isMono: true },
                  { label: "Refundable now", value: formatMoneyForDisplay(order.refundable) },
                ]}
              />
            </Card>
            <Card title="Admin history">
              <ButtonLink href={`/audit?targetType=order&targetId=${encodeURIComponent(order.id)}`} variant="ghost" iconName="arrowUpRight24">Open in audit log</ButtonLink>
            </Card>
          </>
        }
      />
      {isRefundDialogOpen ? <IssueRefundDialog order={order} isOpen onClose={() => setIsRefundDialogOpen(false)} onRefunded={reload} /> : null}
    </>
  );
}
