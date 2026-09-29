"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import type { PosSale } from "@/types/pos.type";
import type { StoreSettings } from "@/types/store.type";
import { formatDateTimeForDisplay } from "@/utils/dateFormatting.util";
import { receiptPaymentMethodLabels } from "@/utils/receiptText.util";

import styles from "./posReceiptDocument.module.css";

interface PosReceiptDocumentProps {
  readonly sale: PosSale;
  readonly settings: StoreSettings;
  readonly locationName: string | null;
  readonly isPendingSync: boolean;
}

export function PosReceiptDocument({ sale, settings, locationName, isPendingSync }: PosReceiptDocumentProps) {
  const { formatMoney } = useMoneyFormatter();
  const receipt = settings.receipt;
  return (
    <article className={`${styles.receipt} ${receipt.paperWidth === "58mm" ? styles.narrow : styles.wide}`} aria-label={`Receipt ${sale.receiptNumber}`}>
      <header className={styles.center}>
        {receipt.showLogo && settings.logoUrl ? <img src={settings.logoUrl} alt="" className={styles.logo} /> : null}
        <p className={styles.storeName}>{settings.name}</p>
        {locationName ? <p>{locationName}</p> : null}
        <p>{settings.address}</p>
        <p>{settings.phone}</p>
        {receipt.headerText ? <p className={styles.gap}>{receipt.headerText}</p> : null}
      </header>
      <hr className={styles.rule} />
      <dl className={styles.rows}>
        <div><dt>Receipt</dt><dd>{isPendingSync ? "Pending sync" : sale.receiptNumber}</dd></div>
        <div><dt>Date</dt><dd>{formatDateTimeForDisplay(sale.offlineCreatedAt ?? sale.createdAt, settings.locale, settings.timezone)}</dd></div>
        {receipt.showCashierName ? <div><dt>Cashier</dt><dd>{sale.cashier.name}</dd></div> : null}
        {sale.customer ? <div><dt>Customer</dt><dd>{sale.customer.name}</dd></div> : null}
      </dl>
      <hr className={styles.rule} />
      <ul className={styles.items}>
        {sale.lines.map((line) => (
          <li key={line.id}>
            <p>{line.name}{line.variantTitle !== "Default" ? ` (${line.variantTitle})` : ""}</p>
            <div className={styles.row}><span>{line.quantity} × {formatMoney(line.unitPrice)}</span><span>{formatMoney(line.lineTotal)}</span></div>
            {line.discountAmount.amountMinor > 0 ? <div className={styles.row}><span>Discount</span><span>−{formatMoney(line.discountAmount)}</span></div> : null}
            {line.refundedQuantity > 0 ? <div className={styles.row}><span>Refunded</span><span>{line.refundedQuantity}</span></div> : null}
          </li>
        ))}
      </ul>
      <hr className={styles.rule} />
      <dl className={styles.rows}>
        <div><dt>Subtotal</dt><dd>{formatMoney(sale.subtotal)}</dd></div>
        {sale.discountTotal.amountMinor > 0 ? <div><dt>Discounts{sale.couponCode ? ` (${sale.couponCode})` : ""}</dt><dd>−{formatMoney(sale.discountTotal)}</dd></div> : null}
        <div><dt>{settings.pricesIncludeTax ? "Tax included" : "Tax"}</dt><dd>{formatMoney(sale.taxTotal)}</dd></div>
        <div className={styles.total}><dt>Total</dt><dd>{formatMoney(sale.total)}</dd></div>
        {sale.payments.map((payment) => (
          <div key={payment.id}><dt>{receiptPaymentMethodLabels[payment.method]}{payment.reference ? ` · ${payment.reference}` : ""}</dt><dd>{formatMoney(payment.tendered ?? payment.amount)}</dd></div>
        ))}
        {sale.changeDue.amountMinor > 0 ? <div><dt>Change</dt><dd>{formatMoney(sale.changeDue)}</dd></div> : null}
        {sale.loyaltyPointsEarned > 0 ? <div><dt>Points earned</dt><dd>{sale.loyaltyPointsEarned}</dd></div> : null}
      </dl>
      <hr className={styles.rule} />
      {receipt.returnPolicy ? <p className={styles.small}>{receipt.returnPolicy}</p> : null}
      {receipt.footerText ? <p className={`${styles.center} ${styles.gap}`}>{receipt.footerText}</p> : null}
    </article>
  );
}

export function PosReceiptPrintPortal(props: PosReceiptDocumentProps) {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const container = document.createElement("div");
    container.setAttribute("data-receipt-print-root", "true");
    document.body.append(container);
    setPortalTarget(container);
    return () => container.remove();
  }, []);
  if (!portalTarget) return null;
  const printStyles = `[data-receipt-print-root]{display:none}@media print{@page{size:${props.settings.receipt.paperWidth} auto;margin:0}body>*:not([data-receipt-print-root]){display:none!important}body>[data-receipt-print-root]{display:block!important}body{background:#fff!important}}`;
  return createPortal(
    <>
      <style>{printStyles}</style>
      <PosReceiptDocument {...props} />
    </>,
    portalTarget,
  );
}
