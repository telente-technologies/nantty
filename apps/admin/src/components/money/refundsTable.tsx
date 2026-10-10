import Link from "next/link";

import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { StatusBadge } from "@/components/ui/statusBadge";
import { UserIdentity } from "@/components/ui/userIdentity";
import type { RefundRecord } from "@/types/commerce.type";
import { formatDateTime, formatMoneyForDisplay, humanizeConstantName } from "@/utils/formatting.util";

import styles from "./money.module.css";

const refundColumns: readonly DataTableColumn<RefundRecord>[] = [
  { key: "order", header: "Order", render: (refund) => <Link href={`/commerce/orders/${refund.orderId}`} className="mono">{refund.orderNumber}</Link> },
  { key: "buyer", header: "Buyer", render: (refund) => <UserIdentity user={refund.buyer} size={22} /> },
  { key: "amount", header: "Amount", render: (refund) => <span className={styles.amount}>{formatMoneyForDisplay(refund.amount)}</span>, align: "end" },
  { key: "source", header: "Source", render: (refund) => humanizeConstantName(refund.source) },
  { key: "status", header: "Status", render: (refund) => <StatusBadge status={refund.status} /> },
  { key: "by", header: "Issued", render: (refund) => <span className={styles.stack}><span>{refund.createdByName || "System"}</span><span className={styles.muted}>{formatDateTime(refund.createdAt)}{refund.completedAt ? ` · done ${formatDateTime(refund.completedAt)}` : ""}</span></span> },
  { key: "reason", header: "Reason", render: (refund) => <span className={styles.muted}>{refund.reason}</span>, width: "30%" },
];

export function RefundsTable({ refunds, isLoading = false, emptyMessage }: { readonly refunds: readonly RefundRecord[]; readonly isLoading?: boolean; readonly emptyMessage: string }) {
  return <DataTable caption="Refunds" columns={refundColumns} rows={refunds} readRowKey={(refund) => refund.id} isLoading={isLoading} emptyMessage={emptyMessage} />;
}
