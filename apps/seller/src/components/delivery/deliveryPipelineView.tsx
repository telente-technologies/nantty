"use client";

import { useMemo, useState } from "react";

import { DeliveryShipmentDialog } from "@/components/delivery/deliveryShipmentDialog";
import { deliveryPipelineDescriptions, deliveryPipelineOrder, deliverySectionTabs } from "@/components/delivery/deliveryPresentation.constant";
import { deliveryStatusPresentation } from "@/components/orders/orderPresentation.constant";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { EmptyState, ErrorCallout, StatTile } from "@/components/ui/feedback";
import { FilterBar, SearchInput } from "@/components/ui/filterControls";
import { LinkTabs } from "@/components/ui/navigationTabs";
import { PageHeader, PageStack, Panel, ResponsiveGrid } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { TablePagination } from "@/components/ui/tablePagination";
import { useClientTableState } from "@/hooks/useClientTableState.hook";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import type { DeliveryPipelineStatus, DeliveryShipment, DeliverySummary } from "@/types/delivery.type";
import type { CursorPage } from "@/types/pagination.type";
import { formatDateForDisplay, formatRelativeTimeFromNow } from "@/utils/dateFormatting.util";
import { formatBasisPointsAsPercent } from "@/utils/money.util";

import styles from "./delivery.module.css";

const shipmentSortReaders = {
  order: (shipment: DeliveryShipment) => shipment.orderedAt,
  destination: (shipment: DeliveryShipment) => `${shipment.state} ${shipment.city}`,
  expected: (shipment: DeliveryShipment) => shipment.estimatedDeliveryAt,
  fee: (shipment: DeliveryShipment) => shipment.deliveryFee.amountMinor,
  updated: (shipment: DeliveryShipment) => shipment.updatedAt,
};

export function DeliveryPipelineView() {
  const { formatMoney } = useMoneyFormatter();
  const [statusFilter, setStatusFilter] = useState<DeliveryPipelineStatus | "all">("all");
  const [searchText, setSearchText] = useState("");
  const [openShipment, setOpenShipment] = useState<DeliveryShipment | null>(null);
  const summaryQuery = useSellerQuery<DeliverySummary>("/seller/delivery/summary");
  const shipmentsQuery = useSellerQuery<CursorPage<DeliveryShipment>>("/seller/delivery/shipments", { status: statusFilter, q: searchText, limit: 200 });
  const shipments = useMemo(() => shipmentsQuery.data?.data ?? null, [shipmentsQuery.data]);
  const table = useClientTableState(shipments, shipmentSortReaders, { pageSize: 12, initialSort: { key: "updated", direction: "descending" } });
  const summary = summaryQuery.data;

  function reloadDeliveryData() {
    shipmentsQuery.reload();
    summaryQuery.reload();
  }

  const columns: DataTableColumn<DeliveryShipment>[] = [
    { key: "order", header: "Order", sortKey: "order", render: (shipment) => <span className={styles.primaryCell}><strong>{shipment.orderNumber}</strong><span className={styles.muted}>{shipment.buyerName} · {shipment.itemsCount} {shipment.itemsCount === 1 ? "item" : "items"}</span></span> },
    { key: "destination", header: "Destination", sortKey: "destination", render: (shipment) => `${shipment.city}, ${shipment.state}` },
    { key: "status", header: "Status", render: (shipment) => <StatusBadge tone={deliveryStatusPresentation[shipment.status].tone}>{deliveryStatusPresentation[shipment.status].label}</StatusBadge> },
    { key: "courier", header: "Courier / rider", hideBelowTablet: true, render: (shipment) => <span className={styles.primaryCell}><span>{shipment.courier ?? "—"}</span><span className={styles.muted}>{shipment.riderName ?? (shipment.trackingNumber ? `Tracking ${shipment.trackingNumber}` : "No rider yet")}</span></span> },
    { key: "expected", header: "Expected", sortKey: "expected", hideBelowTablet: true, render: (shipment) => (shipment.estimatedDeliveryAt ? formatDateForDisplay(shipment.estimatedDeliveryAt) : "—") },
    { key: "fee", header: "Fee", sortKey: "fee", align: "end", hideBelowTablet: true, render: (shipment) => formatMoney(shipment.deliveryFee) },
    { key: "updated", header: "Updated", sortKey: "updated", align: "end", render: (shipment) => formatRelativeTimeFromNow(shipment.updatedAt) },
  ];

  return (
    <PageStack>
      <PageHeader title="Delivery" description="Track every app order from packing to the customer's door. Assign riders, record delivery attempts and follow up on failed ones." />
      <LinkTabs label="Delivery sections" tabs={deliverySectionTabs} />
      {summaryQuery.errorMessage && !summary ? <ErrorCallout error={summaryQuery.error} message={summaryQuery.errorMessage} onRetry={summaryQuery.reload} /> : null}
      <ResponsiveGrid minimumColumnWidth={200}>
        <StatTile label="In transit" value={summary ? summary.countsByStatus.in_transit : "—"} detail={summary ? `${summary.countsByStatus.ready_for_pickup} ready for pickup` : undefined} />
        <StatTile label="Failed attempts" value={summary ? summary.countsByStatus.failed : "—"} tone={summary && summary.countsByStatus.failed > 0 ? "negative" : "neutral"} detail={summary ? `${formatBasisPointsAsPercent(summary.failedDeliveryRateBasisPoints)} of attempts` : undefined} />
        <StatTile label="Average delivery time" value={summary?.averageDeliveryDays !== null && summary?.averageDeliveryDays !== undefined ? `${summary.averageDeliveryDays} days` : "—"} detail="From shipping to delivered" />
        <StatTile label="Delivery fees, 30 days" value={summary ? formatMoney(summary.feesCollectedLast30Days) : "—"} detail="Paid by customers at checkout" />
      </ResponsiveGrid>
      <div className={styles.chipRow} role="group" aria-label="Filter by delivery status">
        <button type="button" className={styles.chip} aria-pressed={statusFilter === "all"} onClick={() => setStatusFilter("all")}>
          All
        </button>
        {deliveryPipelineOrder.map((status) => (
          <button key={status} type="button" className={styles.chip} aria-pressed={statusFilter === status} onClick={() => setStatusFilter(status)} title={deliveryPipelineDescriptions[status]}>
            {deliveryStatusPresentation[status].label}
            {summary?.countsByStatus[status] ? <span className={styles.chipCount}>{summary.countsByStatus[status]}</span> : null}
          </button>
        ))}
      </div>
      {statusFilter !== "all" ? <p className={styles.muted}>{deliveryPipelineDescriptions[statusFilter]}</p> : null}
      <FilterBar>
        <SearchInput label="Search shipments" placeholder="Order, customer, city, tracking or rider" value={searchText} onValueChange={setSearchText} />
      </FilterBar>
      <Panel padded={false}>
        <DataTable
          caption="Shipments"
          columns={columns}
          rows={table.visibleRows}
          readRowKey={(shipment) => shipment.orderId}
          isLoading={shipmentsQuery.isLoading}
          errorMessage={shipmentsQuery.errorMessage}
          onRetry={shipmentsQuery.reload}
          sortState={table.sortState}
          onSortChange={table.setSortState}
          onRowActivate={setOpenShipment}
          emptyState={<EmptyState iconName="truck24" title="Nothing here right now" description="Shipments appear as soon as customers order in the Zudomart app." />}
          footer={<TablePagination pageIndex={table.pageIndex} pageCount={table.pageCount} totalCount={table.totalCount} pageSize={table.pageSize} onPageChange={table.setPageIndex} itemLabel="shipments" />}
        />
      </Panel>
      {openShipment ? <DeliveryShipmentDialog key={openShipment.orderId} shipment={openShipment} onClose={() => setOpenShipment(null)} onShipmentChanged={reloadDeliveryData} /> : null}
    </PageStack>
  );
}
