"use client";

import { Panel, KeyValueList } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import type { ShippingCalculationSnapshot, ShippingOutcome } from "@/types/shipping.type";

const outcomeLabels: Record<ShippingOutcome, string> = {
  fee: "Flat fee",
  free_rule: "Free by rule",
  free_threshold: "Free over threshold",
  not_deliverable: "No matching rule",
};

export function OrderShippingSnapshotPanel({ orderId }: { readonly orderId: string }) {
  const { formatMoney } = useMoneyFormatter();
  const snapshotQuery = useSellerQuery<ShippingCalculationSnapshot>(`/seller/orders/${encodeURIComponent(orderId)}/shipping-snapshot`);
  const snapshot = snapshotQuery.data;
  if (!snapshot) return null;
  const isFree = snapshot.feeCharged.amountMinor === 0;

  return (
    <Panel title="Shipping calculation" description="Priced once for the whole order group, never per item." actions={<StatusBadge tone={isFree ? "success" : "info"}>{isFree ? "Free" : formatMoney(snapshot.feeCharged)}</StatusBadge>}>
      <KeyValueList
        items={[
          { label: "Destination", value: snapshot.destinationLabel },
          { label: "Order subtotal", value: formatMoney(snapshot.orderSubtotal) },
          { label: "Rule applied", value: snapshot.zoneName ?? "Rule no longer exists" },
          { label: "Outcome", value: outcomeLabels[snapshot.outcome] },
          ...(snapshot.thresholdApplied ? [{ label: "Free from", value: formatMoney(snapshot.thresholdApplied) }] : []),
          { label: "Shipping charged", value: isFree ? "Free" : formatMoney(snapshot.feeCharged) },
        ]}
      />
    </Panel>
  );
}
