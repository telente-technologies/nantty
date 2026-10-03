"use client";

import { escrowStatusPresentation, paymentProviderLabels, paymentStatusPresentation } from "@/components/orders/orderPresentation.constant";
import { KeyValueList, Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import type { OnlineOrder } from "@/types/order.type";
import { formatDateForDisplay, formatDateTimeForDisplay } from "@/utils/dateFormatting.util";

import styles from "./orders.module.css";

export function OrderPaymentPanels({ order }: { readonly order: OnlineOrder }) {
  const { formatMoney } = useMoneyFormatter();
  const escrow = escrowStatusPresentation[order.escrowStatus];
  const paymentStatus = paymentStatusPresentation[order.paymentStatus];
  return (
    <>
      <Panel title="Payment" actions={<StatusBadge tone={paymentStatus.tone}>{paymentStatus.label}</StatusBadge>}>
        <KeyValueList
          items={[
            { label: "Items", value: formatMoney(order.subtotal) },
            { label: "Delivery", value: formatMoney(order.shippingFee) },
            { label: "Customer paid", value: formatMoney(order.total) },
            ...(order.refundedAmount.amountMinor > 0 ? [{ label: "Refunded", value: `− ${formatMoney(order.refundedAmount)}` }] : []),
            { label: "Payment processing fee", value: `− ${formatMoney(order.paymentProcessingFee)}` },
            ...(order.paymentMode === "escrow" ? [{ label: `Escrow fee (${order.escrowFeeBasisPoints / 100}%)`, value: `− ${formatMoney(order.escrowFee)}` }] : []),
            { label: "Your payout", value: formatMoney(order.sellerPayout) },
            { label: "Paid with", value: paymentProviderLabels[order.paymentProvider] },
            { label: "Paid on", value: formatDateTimeForDisplay(order.paidAt) },
            { label: "Transaction reference", value: <span className={styles.referenceCode}>{order.paymentReference}</span> },
          ]}
        />
      </Panel>
      <Panel title="Escrow" actions={<StatusBadge tone={escrow.tone}>{escrow.label}</StatusBadge>}>
        <p>{escrow.explanation}</p>
        {order.escrowReleaseAt ? <p className={styles.muted}>Releases automatically on {formatDateForDisplay(order.escrowReleaseAt)} if the customer does not raise a problem.</p> : null}
      </Panel>
      {order.refunds.length > 0 ? (
        <Panel title="Refunds">
          <ul className={styles.noteList}>
            {order.refunds.map((refund) => (
              <li key={refund.id} className={styles.primaryCell}>
                <strong>{formatMoney(refund.amount)}</strong>
                <span className={styles.muted}>
                  {formatDateTimeForDisplay(refund.createdAt)} · {refund.reason}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </>
  );
}
