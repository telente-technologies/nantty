"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { PosReceiptActions } from "@/components/pos/posReceiptActions";
import { PosReceiptDocument } from "@/components/pos/posReceiptDocument";
import { SaleRefundDialog } from "@/components/pos/saleRefundDialog";
import { saleStatusTones } from "@/components/pos/salesHistoryView";
import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { Button, ButtonLink } from "@/components/ui/button";
import { Callout, LoadingBlock } from "@/components/ui/feedback";
import { KeyValueList, PageHeader, PageStack, Panel } from "@/components/ui/panel";
import { StatusBadge, convertSnakeCaseToLabel } from "@/components/ui/statusBadge";
import { useToast } from "@/components/ui/toastProvider";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { useStoreContext } from "@/hooks/useStoreSettings.hook";
import type { CursorPage } from "@/types/pagination.type";
import type { PosSale, SaleRefund } from "@/types/pos.type";
import { formatDateTimeForDisplay } from "@/utils/dateFormatting.util";
import { receiptPaymentMethodLabels } from "@/utils/receiptText.util";

import styles from "./saleDetailView.module.css";

export function SaleDetailView({ saleId }: { readonly saleId: string }) {
  const router = useRouter();
  const { showToast } = useToast();
  const { can } = useSellerSession();
  const { settings, locations } = useStoreContext();
  const { formatMoney } = useMoneyFormatter();
  const saleQuery = useSellerQuery<PosSale>(`/seller/pos/sales/${encodeURIComponent(saleId)}`);
  const refundsQuery = useSellerQuery<CursorPage<SaleRefund>>(`/seller/pos/sales/${encodeURIComponent(saleId)}/refunds`);
  const [isRefundOpen, setIsRefundOpen] = useState(false);
  const sale = saleQuery.data;

  if (saleQuery.isLoading && !sale) return <LoadingBlock label="Loading the sale" />;
  if (!sale || !settings) return <Callout tone="error">{saleQuery.errorMessage ?? "This sale could not be loaded."}</Callout>;
  const locationName = locations.find((location) => location.id === sale.locationId)?.name ?? null;
  const canRefund = can("pos:refund") && sale.status !== "refunded" && sale.status !== "voided";

  return (
    <PageStack>
      <PageHeader
        eyebrow={<ButtonLink href="/sales" variant="ghost" size="small" iconName="arrowLeft24">Sales history</ButtonLink>}
        title={`Receipt ${sale.receiptNumber}`}
        description={`${formatDateTimeForDisplay(sale.createdAt, settings.locale, settings.timezone)} · ${sale.cashier.name}${locationName ? ` · ${locationName}` : ""}`}
        actions={
          <>
            <StatusBadge tone={saleStatusTones[sale.status]}>{convertSnakeCaseToLabel(sale.status)}</StatusBadge>
            {canRefund ? <Button variant="danger" iconName="repeat24" onClick={() => setIsRefundOpen(true)}>Refund or exchange</Button> : null}
          </>
        }
      />
      {sale.offlineCreatedAt ? <Callout tone="info">Rung up offline at {formatDateTimeForDisplay(sale.offlineCreatedAt, settings.locale, settings.timezone)} and synced later.</Callout> : null}
      <div className={styles.columns}>
        <div className={styles.stack}>
          <Panel title="Summary">
            <KeyValueList
              items={[
                { label: "Customer", value: sale.customer ? `${sale.customer.name}${sale.customer.phone ? ` · ${sale.customer.phone}` : ""}` : "Walk-in" },
                { label: "Items", value: String(sale.lines.reduce((sum, line) => sum + line.quantity, 0)) },
                { label: "Subtotal", value: formatMoney(sale.subtotal) },
                { label: "Discounts", value: formatMoney(sale.discountTotal) },
                { label: settings.pricesIncludeTax ? "Tax included" : "Tax", value: formatMoney(sale.taxTotal) },
                { label: "Total", value: formatMoney(sale.total) },
                ...sale.payments.map((payment) => ({ label: `${receiptPaymentMethodLabels[payment.method]}${payment.reference ? ` · ${payment.reference}` : ""}`, value: formatMoney(payment.amount) })),
                ...(sale.couponCode ? [{ label: "Coupon", value: sale.couponCode }] : []),
                ...(sale.loyaltyPointsEarned ? [{ label: "Loyalty points earned", value: String(sale.loyaltyPointsEarned) }] : []),
              ]}
            />
          </Panel>
          <Panel title="Receipt">
            <PosReceiptActions sale={sale} settings={settings} locationName={locationName} isPendingSync={false} />
          </Panel>
          <Panel title="Refunds and exchanges">
            {refundsQuery.data?.data.length ? (
              <ul className={styles.refundList}>
                {refundsQuery.data.data.map((refund) => (
                  <li key={refund.id}>
                    <strong>{refund.kind === "exchange" ? "Exchange" : "Refund"} · {formatMoney(refund.amount)}</strong> to {receiptPaymentMethodLabels[refund.method]} · {refund.createdBy.name} · {formatDateTimeForDisplay(refund.createdAt, settings.locale, settings.timezone)}
                    <p className={styles.muted}>{refund.reason}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.muted}>No refunds on this sale.</p>
            )}
          </Panel>
        </div>
        <div className={styles.receiptPreview}>
          <PosReceiptDocument sale={sale} settings={settings} locationName={locationName} isPendingSync={false} />
        </div>
      </div>
      <SaleRefundDialog
        sale={sale}
        isOpen={isRefundOpen}
        paymentMethods={settings.paymentMethods}
        onClose={() => setIsRefundOpen(false)}
        onRefunded={(refund) => {
          setIsRefundOpen(false);
          saleQuery.reload();
          refundsQuery.reload();
          showToast(`Refunded ${formatMoney(refund.amount)}.`);
          if (refund.kind === "exchange") router.push("/pos");
        }}
      />
    </PageStack>
  );
}
