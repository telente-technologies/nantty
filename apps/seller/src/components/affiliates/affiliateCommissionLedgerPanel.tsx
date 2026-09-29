"use client";

import { useEffect, useState } from "react";

import { DataTable } from "@/components/ui/dataTable";
import { Callout, EmptyState } from "@/components/ui/feedback";
import { SegmentedControl } from "@/components/ui/navigationTabs";
import { Panel } from "@/components/ui/panel";
import { StatusBadge, type StatusTone } from "@/components/ui/statusBadge";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { CommissionLedgerEntry, CommissionLedgerStatus } from "@/types/affiliate.type";
import type { CursorPage } from "@/types/pagination.type";
import { formatDateForDisplay } from "@/utils/dateFormatting.util";

type LedgerFilter = CommissionLedgerStatus | "all";

const ledgerStatusTone: Record<CommissionLedgerStatus, StatusTone> = { owed: "caution", paid: "success", reversed: "neutral" };
const ledgerStatusLabel: Record<CommissionLedgerStatus, string> = { owed: "Owed · in escrow", paid: "Paid", reversed: "Reversed" };
const ledgerPageSize = 25;

export function AffiliateCommissionLedgerPanel() {
  const [statusFilter, setStatusFilter] = useState<LedgerFilter>("all");
  const firstPageQuery = useSellerQuery<CursorPage<CommissionLedgerEntry>>("/seller/affiliates/commission-ledger", { status: statusFilter === "all" ? null : statusFilter, limit: ledgerPageSize });
  const [extraEntries, setExtraEntries] = useState<CommissionLedgerEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const { formatMoney } = useMoneyFormatter();

  useEffect(() => {
    setExtraEntries([]);
    setNextCursor(firstPageQuery.data?.nextCursor ?? null);
  }, [firstPageQuery.data]);

  async function loadMoreLedgerEntries() {
    if (!nextCursor) return;
    setIsLoadingMore(true);
    setLoadMoreError(null);
    try {
      const page = await sendSellerApiRequest<CursorPage<CommissionLedgerEntry>>("/seller/affiliates/commission-ledger", { query: { status: statusFilter === "all" ? null : statusFilter, limit: ledgerPageSize, cursor: nextCursor } });
      setExtraEntries((current) => [...current, ...page.data]);
      setNextCursor(page.nextCursor);
    } catch (error) {
      setLoadMoreError(readErrorMessageForDisplay(error));
    } finally {
      setIsLoadingMore(false);
    }
  }

  const rows = firstPageQuery.data ? [...firstPageQuery.data.data, ...extraEntries] : null;
  return (
    <Panel
      title="Commission ledger"
      description="Commission is taken from the order and paid to the creator automatically when escrow is released. Refunded orders reverse it."
      actions={<SegmentedControl label="Commission status" value={statusFilter} onValueChange={setStatusFilter} options={[{ value: "all", label: "All" }, { value: "owed", label: "Owed" }, { value: "paid", label: "Paid" }, { value: "reversed", label: "Reversed" }]} />}
      padded={false}
    >
      {firstPageQuery.errorMessage || loadMoreError ? <Callout tone="error">{firstPageQuery.errorMessage ?? loadMoreError}</Callout> : null}
      <DataTable
        caption="Creator commission ledger"
        rows={rows}
        isLoading={firstPageQuery.isLoading}
        readRowKey={(entry) => entry.id}
        hasMore={nextCursor !== null}
        onLoadMore={() => void loadMoreLedgerEntries()}
        isLoadingMore={isLoadingMore}
        emptyState={<EmptyState iconName="creditCard24" title="No commissions yet" description="When a creator sells your product, the commission shows up here." />}
        columns={[
          { key: "order", header: "Order", render: (entry) => <strong>{entry.orderNumber}</strong> },
          { key: "creator", header: "Creator", render: (entry) => `@${entry.creatorUsername}` },
          { key: "ordered", header: "Ordered", hideBelowTablet: true, render: (entry) => formatDateForDisplay(entry.orderedAt) },
          { key: "total", header: "Items total", align: "end", hideBelowTablet: true, render: (entry) => formatMoney(entry.orderTotal) },
          { key: "commission", header: "Commission", align: "end", render: (entry) => formatMoney(entry.commission) },
          { key: "status", header: "Status", render: (entry) => <StatusBadge tone={ledgerStatusTone[entry.status]}>{ledgerStatusLabel[entry.status]}</StatusBadge> },
          { key: "when", header: "Paid / release", hideBelowTablet: true, render: (entry) => (entry.paidAt ? formatDateForDisplay(entry.paidAt) : entry.escrowReleaseAt ? `After ${formatDateForDisplay(entry.escrowReleaseAt)}` : "After delivery") },
        ]}
      />
    </Panel>
  );
}
