"use client";

import { useState } from "react";

import { useCommerceCursorList } from "@/components/orders/commerceCursorList.hook";
import { ordersSectionTabs, returnStatusPresentation } from "@/components/orders/orderPresentation.constant";
import { ReturnDecisionDialog, type ReturnDecision } from "@/components/orders/returnDecisionDialog";
import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { EmptyState, ErrorCallout } from "@/components/ui/feedback";
import { LinkTabs, SegmentedControl } from "@/components/ui/navigationTabs";
import { PageHeader, PageStack, Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import type { ReturnRequest, ReturnRequestStatus } from "@/types/order.type";
import { formatDateTimeForDisplay } from "@/utils/dateFormatting.util";

import styles from "./orders.module.css";

export function ReturnsListView() {
  const { can } = useSellerSession();
  const { formatMoney } = useMoneyFormatter();
  const [statusFilter, setStatusFilter] = useState<ReturnRequestStatus | "all">("all");
  const [pendingDecision, setPendingDecision] = useState<{ returnRequest: ReturnRequest; decision: ReturnDecision } | null>(null);
  const returnsList = useCommerceCursorList<ReturnRequest>("/seller/returns", { status: statusFilter });
  const canManage = can("orders:manage");

  const columns: DataTableColumn<ReturnRequest>[] = [
    { key: "order", header: "Order", render: (returnRequest) => <span className={styles.primaryCell}><strong>{returnRequest.orderNumber}</strong><span className={styles.muted}>{formatDateTimeForDisplay(returnRequest.createdAt)}</span></span> },
    { key: "buyer", header: "Buyer", render: (returnRequest) => returnRequest.buyerName },
    { key: "items", header: "Items", hideBelowTablet: true, render: (returnRequest) => returnRequest.lines.map((line) => `${line.quantity} × ${line.name}`).join(", ") },
    { key: "reason", header: "Reason", hideBelowTablet: true, render: (returnRequest) => returnRequest.reason },
    { key: "refund", header: "Refund", align: "end", render: (returnRequest) => formatMoney(returnRequest.refundAmount) },
    { key: "status", header: "Status", render: (returnRequest) => <StatusBadge tone={returnStatusPresentation[returnRequest.status].tone}>{returnStatusPresentation[returnRequest.status].label}</StatusBadge> },
    {
      key: "actions",
      header: <span className="visuallyHidden">Actions</span>,
      align: "end",
      render: (returnRequest) =>
        !canManage ? null : returnRequest.status === "requested" ? (
          <span className={styles.actionRow} style={{ justifyContent: "flex-end" }}>
            <Button size="small" variant="primary" onClick={() => setPendingDecision({ returnRequest, decision: "approve" })}>Approve</Button>
            <Button size="small" onClick={() => setPendingDecision({ returnRequest, decision: "decline" })}>Decline</Button>
          </span>
        ) : returnRequest.status === "approved" ? (
          <Button size="small" variant="primary" onClick={() => setPendingDecision({ returnRequest, decision: "receive" })}>Mark received</Button>
        ) : null,
    },
  ];

  return (
    <PageStack>
      <PageHeader title="Returns" description="Buyers request returns from the Zudomart app and they appear here. Approve, then refund once the item is back with you." />
      <LinkTabs label="Order sections" tabs={ordersSectionTabs} />
      <SegmentedControl
        label="Filter returns"
        value={statusFilter}
        onValueChange={setStatusFilter}
        options={[{ value: "all", label: "All" }, { value: "requested", label: "Requested" }, { value: "approved", label: "Approved" }, { value: "refunded", label: "Refunded" }, { value: "declined", label: "Declined" }]}
      />
      {returnsList.errorMessage ? <ErrorCallout message={returnsList.errorMessage} onRetry={returnsList.reload} /> : null}
      <Panel padded={false}>
        <DataTable
          caption="Return requests"
          columns={columns}
          rows={returnsList.items}
          readRowKey={(returnRequest) => returnRequest.id}
          isLoading={returnsList.isLoading}
          hasMore={returnsList.hasMore}
          onLoadMore={returnsList.loadMore}
          isLoadingMore={returnsList.isLoadingMore}
          emptyState={<EmptyState iconName="repeat24" title="No returns here" description="When a buyer asks to return an item, it shows up in this list." />}
        />
      </Panel>
      <ReturnDecisionDialog
        key={pendingDecision ? `${pendingDecision.returnRequest.id}-${pendingDecision.decision}` : "closed"}
        returnRequest={pendingDecision?.returnRequest ?? null}
        decision={pendingDecision?.decision ?? "approve"}
        onClose={() => setPendingDecision(null)}
        onDecided={() => returnsList.reload()}
      />
    </PageStack>
  );
}
