"use client";

import { useRouter } from "next/navigation";

import { useCommerceCursorList } from "@/components/orders/commerceCursorList.hook";
import { disputeStatusPresentation, ordersSectionTabs } from "@/components/orders/orderPresentation.constant";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { EmptyState, ErrorCallout } from "@/components/ui/feedback";
import { LinkTabs } from "@/components/ui/navigationTabs";
import { PageHeader, PageStack, Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import type { OrderDispute } from "@/types/order.type";
import { formatDateTimeForDisplay, formatRelativeTimeFromNow } from "@/utils/dateFormatting.util";

import styles from "./orders.module.css";

export function DisputesListView() {
  const router = useRouter();
  const { formatMoney } = useMoneyFormatter();
  const disputesList = useCommerceCursorList<OrderDispute>("/seller/disputes", {});

  const columns: DataTableColumn<OrderDispute>[] = [
    { key: "order", header: "Order", render: (dispute) => <span className={styles.primaryCell}><strong>{dispute.orderNumber}</strong><span className={styles.muted}>Opened {formatDateTimeForDisplay(dispute.openedAt)}</span></span> },
    { key: "buyer", header: "Buyer", render: (dispute) => dispute.buyerName },
    { key: "reason", header: "Reason", hideBelowTablet: true, render: (dispute) => dispute.reason },
    { key: "amount", header: "Amount on hold", align: "end", render: (dispute) => formatMoney(dispute.amount) },
    { key: "respondBy", header: "Reply by", render: (dispute) => (dispute.status === "awaiting_seller" && dispute.respondBy ? <strong style={{ color: "var(--error-ink)" }}>{formatRelativeTimeFromNow(dispute.respondBy)}</strong> : "—") },
    { key: "status", header: "Status", render: (dispute) => <StatusBadge tone={disputeStatusPresentation[dispute.status].tone}>{disputeStatusPresentation[dispute.status].label}</StatusBadge> },
  ];

  return (
    <PageStack>
      <PageHeader title="Disputes" description="When a buyer reports a problem, escrow release pauses. Reply with details and photos so Zudomart can decide fairly." />
      <LinkTabs label="Order sections" tabs={ordersSectionTabs} />
      {disputesList.errorMessage ? <ErrorCallout error={disputesList.error} message={disputesList.errorMessage} onRetry={disputesList.reload} /> : null}
      <Panel padded={false}>
        <DataTable
          caption="Disputes"
          columns={columns}
          rows={disputesList.items}
          readRowKey={(dispute) => dispute.id}
          isLoading={disputesList.isLoading}
          onRowActivate={(dispute) => router.push(`/orders/disputes/${dispute.id}`)}
          hasMore={disputesList.hasMore}
          onLoadMore={disputesList.loadMore}
          isLoadingMore={disputesList.isLoadingMore}
          emptyState={<EmptyState iconName="sealCheck20" title="No disputes" description="Nice — no buyer has reported a problem." />}
        />
      </Panel>
    </PageStack>
  );
}
