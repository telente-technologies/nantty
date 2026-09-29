"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { ErrorBlock } from "@/components/ui/feedback";
import { TextField } from "@/components/ui/formFields";
import { PageHeader } from "@/components/ui/pageHeader";
import { Pagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Toolbar } from "@/components/ui/surfaces";
import { SegmentedTabs } from "@/components/ui/tabs";
import { UserIdentity } from "@/components/ui/userIdentity";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchDisputes } from "@/services/moneyApi.service";
import type { DisputeStatus, DisputeSummary } from "@/types/commerce.type";
import { formatMoneyForDisplay, formatRelativeTimeFromNow, humanizeConstantName } from "@/utils/formatting.util";

import styles from "./money.module.css";

type DisputeTabKey = DisputeStatus | "ALL";

function isPastSla(dispute: DisputeSummary): boolean {
  return dispute.status !== "RESOLVED" && new Date(dispute.slaDueAt).getTime() < Date.now();
}

const disputeColumns: readonly DataTableColumn<DisputeSummary>[] = [
  { key: "id", header: "Dispute", render: (dispute) => <span className={styles.stack}><span className="mono">{dispute.id}</span><span className={styles.muted}>{dispute.orderNumber}</span></span> },
  { key: "reason", header: "Reason", render: (dispute) => humanizeConstantName(dispute.reasonCategory) },
  { key: "buyer", header: "Buyer", render: (dispute) => <UserIdentity user={dispute.buyer} size={22} /> },
  { key: "seller", header: "Seller", render: (dispute) => <UserIdentity user={dispute.seller} size={22} /> },
  { key: "escrow", header: "In escrow", render: (dispute) => <span className={styles.amount}>{formatMoneyForDisplay(dispute.escrowAmount)}</span>, align: "end" },
  { key: "priority", header: "Priority", render: (dispute) => <StatusBadge status={dispute.priority} hasDot={false} /> },
  { key: "status", header: "Status", render: (dispute) => <StatusBadge status={dispute.status} /> },
  { key: "sla", header: "SLA", render: (dispute) => (dispute.status === "RESOLVED" ? <span className={styles.muted}>Done</span> : <span className={isPastSla(dispute) ? undefined : styles.muted}>{isPastSla(dispute) ? <StatusBadge label={`Overdue ${formatRelativeTimeFromNow(dispute.slaDueAt)}`} tone="danger" /> : `Due ${formatRelativeTimeFromNow(dispute.slaDueAt)}`}</span>) },
];

export function DisputesWorkspace() {
  const router = useRouter();
  const [status, setStatus] = useState<DisputeTabKey>("ALL");
  const [searchText, setSearchText] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const filters = { status, search: appliedSearch, page };
  const { data, errorMessage, isLoading, reload } = useAdminQuery((signal) => fetchDisputes(filters, signal), JSON.stringify(filters));
  const counts = data?.counts;
  const tabs = [
    { key: "ALL" as const, label: "All" },
    { key: "OPEN" as const, label: "Open", count: counts?.OPEN ?? null },
    { key: "AWAITING_SELLER" as const, label: "Awaiting seller", count: counts?.AWAITING_SELLER ?? null },
    { key: "IN_REVIEW" as const, label: "In review", count: counts?.IN_REVIEW ?? null },
    { key: "RESOLVED" as const, label: "Resolved", count: counts?.RESOLVED ?? null },
  ];

  function applySearch(event: FormEvent) {
    event.preventDefault();
    setAppliedSearch(searchText.trim());
    setPage(1);
  }

  return (
    <>
      <PageHeader area="Money" title="Disputes" description="Buyer and seller disagreements with money still in escrow. Most urgent and overdue first." />
      <SegmentedTabs label="Dispute status" items={tabs} activeKey={status} onChange={(key) => { setStatus(key); setPage(1); }} />
      <form onSubmit={applySearch}>
        <Toolbar>
          <TextField label="Search disputes" isLabelHidden placeholder="Dispute ID, order number, @username or store" value={searchText} onChange={(event) => setSearchText(event.target.value)} className={styles.searchField} />
          <Button type="submit" iconName="magnifyingGlass16">Search</Button>
        </Toolbar>
      </form>
      {errorMessage ? <ErrorBlock message={errorMessage} onRetry={reload} /> : null}
      <DataTable caption="Disputes" columns={disputeColumns} rows={data?.items ?? []} readRowKey={(dispute) => dispute.id} isLoading={isLoading} onRowOpen={(dispute) => router.push(`/commerce/disputes/${dispute.id}`)} readRowTone={(dispute) => (isPastSla(dispute) ? "danger" : dispute.priority === "HIGH" && dispute.status !== "RESOLVED" ? "caution" : null)} emptyMessage="No disputes here. Nice." />
      {data ? <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} /> : null}
    </>
  );
}
