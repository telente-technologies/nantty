"use client";

import { KeyValueList, Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import type { PosShift } from "@/types/pos.type";
import { formatDateTimeForDisplay } from "@/utils/dateFormatting.util";
import { receiptPaymentMethodLabels } from "@/utils/receiptText.util";

export function PosShiftReport({ shift, registerName }: { readonly shift: PosShift; readonly registerName: string }) {
  const { formatMoney } = useMoneyFormatter();
  const variance = shift.cashVariance?.amountMinor ?? 0;
  return (
    <Panel
      title={`${shift.status === "open" ? "Current shift" : "Shift report"} · ${registerName}`}
      description={`Opened by ${shift.openedBy.name} · ${formatDateTimeForDisplay(shift.openedAt)}${shift.closedAt ? ` · Closed ${formatDateTimeForDisplay(shift.closedAt)} by ${shift.closedBy?.name ?? "—"}` : ""}`}
      actions={shift.status === "closed" ? <StatusBadge tone={variance === 0 ? "success" : variance < 0 ? "error" : "caution"}>{variance === 0 ? "Balanced" : variance < 0 ? "Short" : "Over"}</StatusBadge> : <StatusBadge tone="info">Open</StatusBadge>}
    >
      <KeyValueList
        items={[
          { label: "Sales", value: String(shift.totals.salesCount) },
          { label: "Gross sales", value: formatMoney(shift.totals.grossSales) },
          { label: "Refunds", value: formatMoney(shift.totals.refunds) },
          { label: "Net sales", value: formatMoney(shift.totals.netSales) },
          ...shift.totals.byPaymentMethod.map((entry) => ({ label: `  ${receiptPaymentMethodLabels[entry.method]}`, value: formatMoney(entry.amount) })),
          { label: "Opening float", value: formatMoney(shift.openingFloat) },
          ...shift.cashMovements.map((movement) => ({ label: `${movement.kind === "pay_in" ? "Pay in" : "Pay out"} · ${movement.reason}`, value: `${movement.kind === "pay_in" ? "+" : "−"}${formatMoney(movement.amount)}` })),
          { label: "Expected cash in drawer", value: formatMoney(shift.expectedCash) },
          ...(shift.countedCash ? [{ label: "Counted cash", value: formatMoney(shift.countedCash) }] : []),
          ...(shift.cashVariance ? [{ label: "Variance", value: `${variance > 0 ? "+" : ""}${formatMoney(shift.cashVariance)}` }] : []),
          ...(shift.closingNote ? [{ label: "Note", value: shift.closingNote }] : []),
        ]}
      />
    </Panel>
  );
}
