"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { ErrorBlock } from "@/components/ui/feedback";
import { TextField } from "@/components/ui/formFields";
import { PageHeader } from "@/components/ui/pageHeader";
import { CursorPagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Toolbar } from "@/components/ui/surfaces";
import { SegmentedTabs } from "@/components/ui/tabs";
import { UserIdentity } from "@/components/ui/userIdentity";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchDisputes } from "@/services/moneyApi.service";
import type { DisputeStatusFilter, DisputeSummary } from "@/types/commerce.type";
import { formatMoneyForDisplay, formatRelativeTimeFromNow, humanizeConstantName } from "@/utils/formatting.util";
import { toIdentityUser } from "@/utils/partySummary.util";

import styles from "./money.module.css";

export function isDisputeOpen(dispute: Pick<DisputeSummary, "status">): boolean {
  return dispute.status === "awaiting_seller" || dispute.status === "under_review";
}

function renderSla(dispute: DisputeSummary) {
  if (!isDisputeOpen(dispute)) return <span className={styles.muted}>Done</span>;
  if (!dispute.slaDueAt) return <span className={styles.muted}>—</span>;
  if (dispute.isSlaBreached) return <StatusBadge label={`Overdue ${formatRelativeTimeFromNow(dispute.slaDueAt)}`} tone="danger" />;
  return <span className={styles.muted}>Due {formatRelativeTimeFromNow(dispute.slaDueAt)}</span>;
}

const disputeColumns: readonly DataTableColumn<DisputeSummary>[] = [
  { key: "order", header: "Order", render: (dispute) => <span className={styles.stack}><span className="mono">{dispute.orderNumber}</span><span className={styles.muted}>{dispute.productName}</span></span> },
  { key: "reason", header: "Reason", render: (dispute) => humanizeConstantName(dispute.reason) },
  { key: "buyer", header: "Buyer", render: (dispute) => <UserIdentity user={toIdentityUser(dispute.buyer)} size={22} /> },
  { key: "seller", header: "Store", render: (dispute) => <span className={styles.stack}><strong>{dispute.store.name ?? "Store"}</strong><span className={styles.muted}>{dispute.seller.username ? `@${dispute.seller.username}` : dispute.seller.id}</span></span> },
  { key: "escrow", header: "In escrow", render: (dispute) => <span className={styles.amount}>{formatMoneyForDisplay(dispute.escrowAmount)}</span>, align: "end" },
  { key: "priority", header: "Priority", render: (dispute) => <StatusBadge status={dispute.priority} hasDot={false} /> },
  { key: "status", header: "Status", render: (dispute) => <StatusBadge status={dispute.status} /> },
  { key: "sla", header: "SLA", render: renderSla },
];

export function DisputesWorkspace() {
  const router = useRouter();
  const [status, setStatus] = useState<DisputeStatusFilter>("open");
  const [searchText, setSearchText] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [cursor, setCursor] = useState<string | undefined>();
  const filters = { status, search: appliedSearch || undefined, cursor };
  const { data, errorMessage, isLoading, reload } = useAdminQuery((signal) => fetchDisputes(filters, signal), JSON.stringify(filters));
  const counts = data?.counts;
  const openCount = counts ? (counts.awaiting_seller ?? 0) + (counts.under_review ?? 0) : null;
  const tabs = [
    { key: "open" as const, label: "Open", count: openCount },
    { key: "awaiting_seller" as const, label: "Awaiting seller", count: counts?.awaiting_seller ?? null },
    { key: "under_review" as const, label: "Under review", count: counts?.under_review ?? null },
    { key: "resolved" as const, label: "Resolved" },
    { key: "all" as const, label: "All" },
  ];

  function applySearch(event: FormEvent) {
    event.preventDefault();
    setAppliedSearch(searchText.trim());
    setCursor(undefined);
  }

  return (
    <>
      <PageHeader area="Money" title="Disputes" description="Buyer and seller disagreements with money still in escrow. Newest first; overdue ones are highlighted." />
      <SegmentedTabs label="Dispute status" items={tabs} activeKey={status} onChange={(key) => { setStatus(key); setCursor(undefined); }} />
      <form onSubmit={applySearch}>
        <Toolbar>
          <TextField label="Search disputes" isLabelHidden placeholder="Dispute ID, order number or product" value={searchText} onChange={(event) => setSearchText(event.target.value)} className={styles.searchField} />
          <Button type="submit" iconName="magnifyingGlass16">Search</Button>
        </Toolbar>
      </form>
      {errorMessage ? <ErrorBlock message={errorMessage} onRetry={reload} /> : null}
      <DataTable caption="Disputes" columns={disputeColumns} rows={data?.items ?? []} readRowKey={(dispute) => dispute.id} isLoading={isLoading} onRowOpen={(dispute) => router.push(`/commerce/disputes/${dispute.id}`)} readRowTone={(dispute) => (isDisputeOpen(dispute) && dispute.isSlaBreached ? "danger" : dispute.priority !== "normal" && isDisputeOpen(dispute) ? "caution" : null)} emptyMessage="No disputes here. Nice." />
      <CursorPagination cursor={cursor} nextCursor={data?.nextCursor} onCursorChange={setCursor} />
    </>
  );
}
