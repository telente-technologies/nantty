"use client";

import { useState } from "react";

import { PlanGate } from "@/components/billing/planGate";
import { InventoryTabs } from "@/components/inventory/inventoryTabs";
import { NewStockTransferDialog } from "@/components/inventory/newStockTransferDialog";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { Callout, EmptyState, ErrorCallout } from "@/components/ui/feedback";
import { SegmentedControl } from "@/components/ui/navigationTabs";
import { PageHeader, PageStack, Panel } from "@/components/ui/panel";
import { StatusBadge, type StatusTone } from "@/components/ui/statusBadge";
import { useToast } from "@/components/ui/toastProvider";
import { useCursorPagedList } from "@/hooks/useCursorPagedList.hook";
import { usePlanFeatures } from "@/hooks/usePlanFeatures.hook";
import { useStoreContext } from "@/hooks/useStoreSettings.hook";
import { createIdempotencyKey, readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { StockTransfer, StockTransferStatus } from "@/types/catalog.type";
import { formatDateTimeForDisplay } from "@/utils/dateFormatting.util";

import styles from "./inventoryViews.module.css";

const transferStatusTone: Record<StockTransferStatus, StatusTone> = { in_transit: "info", received: "success", cancelled: "neutral" };
const transferStatusLabel: Record<StockTransferStatus, string> = { in_transit: "In transit", received: "Received", cancelled: "Cancelled" };

function StockTransfersPanel({ isDialogOpen, onDialogClose }: { readonly isDialogOpen: boolean; readonly onDialogClose: () => void }) {
  const { locations } = useStoreContext();
  const { showToast } = useToast();
  const [statusFilter, setStatusFilter] = useState<"" | StockTransferStatus>("");
  const [busyTransferId, setBusyTransferId] = useState<string | null>(null);
  const transfers = useCursorPagedList<StockTransfer>("/seller/inventory/transfers", { status: statusFilter, limit: 25 });
  const locationName = (locationId: string) => locations.find((location) => location.id === locationId)?.name ?? locationId;

  async function finishTransfer(transfer: StockTransfer, outcome: "receive" | "cancel") {
    if (outcome === "cancel" && !window.confirm(`Cancel ${transfer.reference}? The stock goes back to ${locationName(transfer.fromLocationId)}.`)) return;
    setBusyTransferId(transfer.id);
    try {
      await sendSellerApiRequest(`/seller/inventory/transfers/${encodeURIComponent(transfer.id)}/${outcome}`, { method: "POST", body: {}, idempotencyKey: createIdempotencyKey(outcome) });
      showToast(outcome === "receive" ? `${transfer.reference} received.` : `${transfer.reference} cancelled.`);
      transfers.reload();
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setBusyTransferId(null);
    }
  }

  const columns: DataTableColumn<StockTransfer>[] = [
    { key: "reference", header: "Transfer", render: (transfer) => <strong>{transfer.reference}</strong> },
    { key: "route", header: "Route", render: (transfer) => `${locationName(transfer.fromLocationId)} to ${locationName(transfer.toLocationId)}` },
    { key: "items", header: "Items", render: (transfer) => transfer.lines.map((line) => `${line.quantity} × ${line.productName}${line.variantTitle !== "Default" ? ` (${line.variantTitle})` : ""}`).join(", ") },
    { key: "sent", header: "Sent", hideBelowTablet: true, render: (transfer) => `${formatDateTimeForDisplay(transfer.createdAt)} · ${transfer.createdBy.name}` },
    { key: "status", header: "Status", render: (transfer) => <StatusBadge tone={transferStatusTone[transfer.status]}>{transferStatusLabel[transfer.status]}</StatusBadge> },
    {
      key: "actions",
      header: <span className="visuallyHidden">Actions</span>,
      align: "end",
      render: (transfer) => transfer.status === "in_transit" ? (
        <div className={styles.rowActions}>
          <Button size="small" variant="primary" isBusy={busyTransferId === transfer.id} onClick={() => void finishTransfer(transfer, "receive")}>Receive</Button>
          <Button size="small" variant="ghost" disabled={busyTransferId === transfer.id} onClick={() => void finishTransfer(transfer, "cancel")}>Cancel</Button>
        </div>
      ) : null,
    },
  ];

  return (
    <>
      {locations.length < 2 ? <Callout tone="info">Add a second location in Settings to transfer stock.</Callout> : null}
      <Panel padded={false}>
        <div className={styles.toolbar}>
          <SegmentedControl label="Transfer status" value={statusFilter} onValueChange={setStatusFilter} options={[{ value: "", label: "All" }, { value: "in_transit", label: "In transit" }, { value: "received", label: "Received" }, { value: "cancelled", label: "Cancelled" }]} />
        </div>
        {transfers.errorMessage ? <div className={styles.toolbar}><ErrorCallout message={transfers.errorMessage} onRetry={transfers.reload} /></div> : null}
        <DataTable caption="Stock transfers" columns={columns} rows={transfers.items} readRowKey={(transfer) => transfer.id} isLoading={transfers.isLoading} hasMore={transfers.hasMore} onLoadMore={transfers.loadMore} isLoadingMore={transfers.isLoadingMore} emptyState={<EmptyState iconName="repeat24" title="No transfers yet" description="Send stock from your warehouse to a shop when it runs low." />} />
      </Panel>
      <NewStockTransferDialog isOpen={isDialogOpen} onClose={onDialogClose} onSaved={() => { onDialogClose(); transfers.reload(); }} />
    </>
  );
}

export function StockTransfersView() {
  const { locations } = useStoreContext();
  const { hasFeature } = usePlanFeatures();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  return (
    <PageStack>
      <PageHeader title="Stock transfers" description="Move stock between your shops and warehouses. Units in transit cannot be sold anywhere." actions={hasFeature("advanced_inventory") ? <Button variant="primary" iconName="repeat24" onClick={() => setIsDialogOpen(true)} disabled={locations.length < 2}>New transfer</Button> : null} />
      <InventoryTabs />
      <PlanGate feature="advanced_inventory" description="Send stock between your shops and warehouses and receive it at the other end, with a full record.">
        <StockTransfersPanel isDialogOpen={isDialogOpen} onDialogClose={() => setIsDialogOpen(false)} />
      </PlanGate>
    </PageStack>
  );
}
