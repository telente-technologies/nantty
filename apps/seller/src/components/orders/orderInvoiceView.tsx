"use client";

import Link from "next/link";

import { paymentProviderLabels } from "@/components/orders/orderPresentation.constant";
import { Button } from "@/components/ui/button";
import { ErrorCallout, LoadingBlock } from "@/components/ui/feedback";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { useStoreContext } from "@/hooks/useStoreSettings.hook";
import type { OnlineOrder } from "@/types/order.type";
import { formatDateForDisplay, formatDateTimeForDisplay } from "@/utils/dateFormatting.util";

import styles from "./packingSlipView.module.css";
import { IconLabel } from "@/components/ui/nanttyIcon";

export function OrderInvoiceView({ orderId, documentKind }: { readonly orderId: string; readonly documentKind: "invoice" | "receipt" }) {
  const { settings } = useStoreContext();
  const { formatMoney } = useMoneyFormatter();
  const orderQuery = useSellerQuery<OnlineOrder>(`/seller/orders/${encodeURIComponent(orderId)}`);
  const order = orderQuery.data;
  const isReceipt = documentKind === "receipt";

  if (orderQuery.isLoading && !order) return <LoadingBlock label={`Preparing ${documentKind}`} />;
  if (!order) return <ErrorCallout variant="section" error={orderQuery.error} message={orderQuery.errorMessage ?? "This order could not be loaded."} onRetry={orderQuery.reload} />;

  const amountPaidAfterRefunds = { amountMinor: order.total.amountMinor - order.refundedAmount.amountMinor, currency: order.total.currency };

  return (
    <div className={styles.page}>
      <style>{"@media print { @page { size: A4; margin: 14mm; } }"}</style>
      <div className={`${styles.toolbar} noPrint`}>
        <Link href={`/orders/${order.id}`}><IconLabel name="arrowLeft24" size={16}>Back to order</IconLabel></Link>
        <Link href={`/orders/${order.id}/invoice${isReceipt ? "" : "?document=receipt"}`}>Switch to {isReceipt ? "invoice" : "receipt"}</Link>
        <Button variant="primary" iconName="export24" onClick={() => window.print()}>
          Print or save as PDF
        </Button>
      </div>
      <article className={`${styles.slip} ${styles.a4}`} aria-label={`${isReceipt ? "Receipt" : "Invoice"} for ${order.orderNumber}`}>
        <header className={styles.slipHeader}>
          <div>
            <p className={styles.storeName}>{settings?.name ?? "Your store"}</p>
            <p className={styles.small}>{settings?.address}</p>
            <p className={styles.small}>
              {settings?.phone} · {settings?.email}
            </p>
            <p className={styles.small}>nantty.com/@{settings?.handle}</p>
          </div>
          <div className={styles.orderMeta}>
            <p className={styles.slipTitle}>{isReceipt ? "Payment receipt" : "Invoice"}</p>
            <p>{isReceipt ? `Receipt for ${order.orderNumber}` : order.invoiceNumber}</p>
            <p className={styles.small}>Order {order.orderNumber}</p>
            <p className={styles.small}>{isReceipt ? `Paid ${formatDateTimeForDisplay(order.paidAt)}` : `Issued ${formatDateForDisplay(order.createdAt)}`}</p>
          </div>
        </header>
        <section className={styles.addressBlock}>
          <p className={styles.label}>Billed to</p>
          <p>
            <strong>{order.buyer.name}</strong> (@{order.buyer.username})
          </p>
          <p>{order.shippingAddress.line1}</p>
          {order.shippingAddress.line2 ? <p>{order.shippingAddress.line2}</p> : null}
          {order.shippingAddress.details ? <p>{order.shippingAddress.details}</p> : null}
          <p>
            {order.shippingAddress.city}, {order.shippingAddress.state}, {order.shippingAddress.country}
          </p>
          {order.shippingAddress.postalCode ? <p>{order.shippingAddress.postalCode}</p> : null}
          <p>{order.shippingAddress.phone}</p>
        </section>
        <table className={styles.itemsTable}>
          <thead>
            <tr>
              <th scope="col">Item</th>
              <th scope="col">SKU</th>
              <th scope="col" className={styles.quantityCell}>Qty</th>
              <th scope="col" className={styles.quantityCell}>Unit price</th>
              <th scope="col" className={styles.quantityCell}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((line) => (
              <tr key={line.id}>
                <td>
                  {line.name}
                  <br />
                  <span className={styles.small}>{line.variantTitle}</span>
                </td>
                <td>{line.sku}</td>
                <td className={styles.quantityCell}>{line.quantity}</td>
                <td className={styles.quantityCell}>{formatMoney(line.unitPrice)}</td>
                <td className={styles.quantityCell}>{formatMoney(line.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4}>Subtotal</td>
              <td className={styles.quantityCell}>{formatMoney(order.subtotal)}</td>
            </tr>
            <tr>
              <td colSpan={4}>Delivery</td>
              <td className={styles.quantityCell}>{formatMoney(order.shippingFee)}</td>
            </tr>
            {order.refundedAmount.amountMinor > 0 ? (
              <tr>
                <td colSpan={4}>Refunded</td>
                <td className={styles.quantityCell}>− {formatMoney(order.refundedAmount)}</td>
              </tr>
            ) : null}
            <tr>
              <td colSpan={4}>
                <strong>{isReceipt ? "Amount paid" : "Total"}</strong>
              </td>
              <td className={styles.quantityCell}>
                <strong>{formatMoney(isReceipt ? amountPaidAfterRefunds : order.total)}</strong>
              </td>
            </tr>
          </tfoot>
        </table>
        <footer className={styles.slipFooter}>
          <p className={styles.small}>
            {order.paymentMode === "escrow" ? "Paid with escrow protection" : "Paid directly"} · {paymentProviderLabels[order.paymentProvider]} · reference {order.paymentReference}
          </p>
          <p className={styles.small}>Questions? Message us on Nantty @{settings?.handle}.</p>
        </footer>
      </article>
    </div>
  );
}
