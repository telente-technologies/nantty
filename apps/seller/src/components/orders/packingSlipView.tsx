"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ErrorCallout, LoadingBlock } from "@/components/ui/feedback";
import { SegmentedControl } from "@/components/ui/navigationTabs";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { useStoreContext } from "@/hooks/useStoreSettings.hook";
import type { OnlineOrder } from "@/types/order.type";
import { formatDateForDisplay } from "@/utils/dateFormatting.util";

import styles from "./packingSlipView.module.css";
import { IconLabel } from "@/components/ui/zudoIcon";

export function PackingSlipView({ orderId }: { readonly orderId: string }) {
  const { settings } = useStoreContext();
  const orderQuery = useSellerQuery<OnlineOrder>(`/seller/orders/${encodeURIComponent(orderId)}`);
  const [paperSize, setPaperSize] = useState<"A4" | "A5">("A5");
  const order = orderQuery.data;

  if (orderQuery.isLoading && !order) return <LoadingBlock label="Preparing packing slip" />;
  if (!order) return <ErrorCallout variant="section" error={orderQuery.error} message={orderQuery.errorMessage ?? "This order could not be loaded."} onRetry={orderQuery.reload} />;

  return (
    <div className={styles.page}>
      <style>{`@media print { @page { size: ${paperSize}; margin: 12mm; } }`}</style>
      <div className={`${styles.toolbar} noPrint`}>
        <Link href={`/orders/${order.id}`}><IconLabel name="arrowLeft24" size={16}>Back to order</IconLabel></Link>
        <SegmentedControl label="Paper size" value={paperSize} onValueChange={setPaperSize} options={[{ value: "A5", label: "A5" }, { value: "A4", label: "A4" }]} />
        <Button variant="primary" iconName="export24" onClick={() => window.print()}>
          Print packing slip
        </Button>
      </div>
      <article className={`${styles.slip} ${paperSize === "A5" ? styles.a5 : styles.a4}`} aria-label={`Packing slip for ${order.orderNumber}`}>
        <header className={styles.slipHeader}>
          <div>
            <p className={styles.storeName}>{settings?.name ?? "Your store"}</p>
            <p className={styles.small}>{settings?.address}</p>
            <p className={styles.small}>{settings?.phone}</p>
          </div>
          <div className={styles.orderMeta}>
            <p className={styles.slipTitle}>Packing slip</p>
            <p>{order.orderNumber}</p>
            <p className={styles.small}>Ordered {formatDateForDisplay(order.createdAt)}</p>
          </div>
        </header>
        <section className={styles.addressBlock}>
          <p className={styles.label}>Ship to</p>
          <p><strong>{order.shippingAddress.recipientName}</strong></p>
          <p>{order.shippingAddress.line1}</p>
          <p>{order.shippingAddress.city}, {order.shippingAddress.state}, {order.shippingAddress.country}</p>
          <p>{order.shippingAddress.phone}</p>
        </section>
        <table className={styles.itemsTable}>
          <thead>
            <tr>
              <th scope="col">Packed</th>
              <th scope="col">Item</th>
              <th scope="col">SKU</th>
              <th scope="col" className={styles.quantityCell}>Qty</th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((line) => (
              <tr key={line.id}>
                <td><span className={styles.checkBox} aria-hidden="true" /></td>
                <td>{line.name}<br /><span className={styles.small}>{line.variantTitle}</span></td>
                <td>{line.sku}</td>
                <td className={styles.quantityCell}>{line.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <footer className={styles.slipFooter}>
          <p>Items: {order.lines.reduce((sum, line) => sum + line.quantity, 0)}</p>
          <p className={styles.small}>Something not right? Request a return from the order in the Zudomart app.</p>
          <p className={styles.small}>Questions? Message us on Zudomart @{settings?.handle}</p>
        </footer>
      </article>
    </div>
  );
}
