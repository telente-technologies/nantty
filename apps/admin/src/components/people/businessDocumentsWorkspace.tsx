"use client";

import { useState } from "react";

import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { ErrorBlock } from "@/components/ui/feedback";
import { TextField } from "@/components/ui/formFields";
import { PageHeader } from "@/components/ui/pageHeader";
import { CursorPagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Toolbar } from "@/components/ui/surfaces";
import { LinkTabs, SegmentedTabs } from "@/components/ui/tabs";
import { UserIdentity } from "@/components/ui/userIdentity";
import { verificationViewTabs } from "@/constants/identityVerification.constant";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchBusinessDocumentSubmissions } from "@/services/safetyApi.service";
import type { BusinessDocumentSubmission } from "@/types/businessDocuments.type";
import { formatRelativeTimeFromNow, humanizeConstantName } from "@/utils/formatting.util";

import { BusinessDocumentsReviewPanel } from "./businessDocumentsReviewPanel";
import styles from "./peopleWorkspace.module.css";

const statusTabs = [{ key: "PENDING", label: "Needs review" }, { key: "REJECTED", label: "Rejected" }, { key: "APPROVED", label: "Approved" }, { key: "ALL", label: "All" }] as const;

const columns: readonly DataTableColumn<BusinessDocumentSubmission>[] = [
  { key: "store", header: "Store", render: (item) => <UserIdentity user={{ ...item.user, displayName: item.storeName }} /> },
  { key: "plan", header: "Plan", render: (item) => humanizeConstantName(item.plan) },
  { key: "docs", header: "Documents", render: (item) => `${item.documents.filter((document) => document.status === "APPROVED").length}/${item.documents.length} approved` },
  { key: "status", header: "Status", render: (item) => <StatusBadge status={item.overallStatus} /> },
  { key: "gold", header: "Gold", render: (item) => <StatusBadge tone={item.goldCheckmark === "GRANTED" ? "success" : "neutral"} label={humanizeConstantName(item.goldCheckmark)} hasDot={false} /> },
  { key: "submitted", header: "Submitted", render: (item) => <span className={styles.muted}>{formatRelativeTimeFromNow(item.submittedAt)}</span> },
];

export function BusinessDocumentsWorkspace() {
  const [status, setStatus] = useState<(typeof statusTabs)[number]["key"]>("PENDING");
  const [search, setSearch] = useState("");
  const [cursor, setCursor] = useState<string | undefined>();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const filters = { status, search: search || undefined, cursor };
  const { data, errorMessage, isLoading, reload, replaceData } = useAdminQuery((signal) => fetchBusinessDocumentSubmissions(filters, signal), JSON.stringify(filters));
  const selected = data?.items.find((item) => item.id === selectedId) ?? null;

  return (
    <>
      <PageHeader area="People" title="Business documents" description="CAC certificates, IDs and proofs of address that sellers upload from their dashboard. Selling is never blocked while these wait." />
      <LinkTabs label="Verification views" items={verificationViewTabs} />
      <SegmentedTabs label="Document status" items={statusTabs} activeKey={status} onChange={(key) => { setStatus(key); setCursor(undefined); }} />
      <Toolbar>
        <TextField label="Search" isLabelHidden type="search" placeholder="Search store, @username or ID" value={search} onChange={(event) => { setSearch(event.target.value); setCursor(undefined); }} />
      </Toolbar>
      {errorMessage ? <ErrorBlock message={errorMessage} onRetry={reload} /> : null}
      <DataTable caption="Business documents queue" columns={columns} rows={data?.items ?? []} readRowKey={(item) => item.id} onRowOpen={(item) => setSelectedId(item.id)} selectedRowKey={selectedId} isLoading={isLoading} emptyMessage="No business documents here." />
      <CursorPagination cursor={cursor} nextCursor={data?.nextCursor} onCursorChange={setCursor} />
      {selected ? <BusinessDocumentsReviewPanel key={selected.id} submission={selected} onClose={() => setSelectedId(null)} onChanged={(updated) => { replaceData((current) => current ? { ...current, items: current.items.map((item) => item.id === updated.id ? updated : item) } : current); reload(); }} /> : null}
    </>
  );
}
