"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { ErrorBlock } from "@/components/ui/feedback";
import { SelectField } from "@/components/ui/formFields";
import { PageHeader } from "@/components/ui/pageHeader";
import { CursorPagination } from "@/components/ui/pagination";
import { useAdminPermissions } from "@/components/session/adminSessionProvider";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Toolbar } from "@/components/ui/surfaces";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchLogisticsShipments } from "@/services/logisticsApi.service";
import type { LogisticsShipmentStatus, LogisticsShipmentSummary } from "@/types/logistics.type";
import { formatDateTime, formatRelativeTimeFromNow, humanizeConstantName } from "@/utils/formatting.util";

const statusOptions = ["", "pending", "quoted", "booked", "picked_up", "in_transit", "delivered", "cancelled", "failed"].map((value) => ({ value, label: value ? humanizeConstantName(value) : "All shipment states" }));

function safeTrackingUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}

export function LogisticsWorkspace() {
  const router = useRouter();
  const { canAny } = useAdminPermissions();
  const [status, setStatus] = useState("");
  const [cursor, setCursor] = useState<string | undefined>();
  const filters = { status: status ? status as LogisticsShipmentStatus : undefined, cursor };
  const { data, errorMessage, error, isLoading, reload } = useAdminQuery((signal) => fetchLogisticsShipments(filters, signal), JSON.stringify(filters));
  const columns: readonly DataTableColumn<LogisticsShipmentSummary>[] = [
    { key: "reference", header: "Order", render: (row) => row.reference, isMono: true },
    { key: "provider", header: "Delivery partner", render: (row) => row.provider },
    { key: "tracking", header: "Tracking", render: (row) => {
      const url = safeTrackingUrl(row.trackingUrl);
      return <span>{row.trackingNumber ? <span className="mono">{row.trackingNumber}</span> : <span className="muted">Not available</span>}{url ? <> · <a href={url} target="_blank" rel="noopener noreferrer">Track shipment</a></> : null}</span>;
    } },
    { key: "status", header: "Shipment", render: (row) => <StatusBadge status={row.status} /> },
    { key: "exception", header: "Exception", render: (row) => row.exception ? <span><StatusBadge status={row.exception.status} /> <span>{humanizeConstantName(row.exception.reason)}</span></span> : <span className="muted">None recorded</span> },
    { key: "updated", header: "Last updated", render: (row) => <span title={formatDateTime(row.updatedAt)}>{formatRelativeTimeFromNow(row.updatedAt)}</span> },
  ];

  return (
    <>
      <PageHeader area="Operations" title="Logistics" description="Review shipped orders and delivery exceptions. Seller tracking details come from the order record; provider booking, cancellation, and retry controls remain unavailable until a carrier integration is approved and enabled." />
      <Toolbar>
        <SelectField label="Shipment state" isLabelHidden options={statusOptions} value={status} onChange={(event) => { setStatus(event.target.value); setCursor(undefined); }} />
      </Toolbar>
      {errorMessage ? <ErrorBlock error={error} message={errorMessage} onRetry={reload} /> : null}
      <DataTable caption="Logistics shipments" columns={columns} rows={data?.items ?? []} readRowKey={(row) => row.shipmentId} isLoading={isLoading} onRowOpen={canAny("orders:read", "disputes:resolve", "refunds:issue", "support:tickets") ? (row) => router.push(`/commerce/orders/${encodeURIComponent(row.orderId)}`) : undefined} emptyMessage="No shipment records match this filter." />
      <CursorPagination cursor={cursor} nextCursor={data?.nextCursor} onCursorChange={setCursor} />
    </>
  );
}
