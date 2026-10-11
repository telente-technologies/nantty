"use client";

import { useState } from "react";

import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { ErrorBlock } from "@/components/ui/feedback";
import { SelectField, TextField } from "@/components/ui/formFields";
import { PageHeader } from "@/components/ui/pageHeader";
import { CursorPagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Toolbar } from "@/components/ui/surfaces";
import { SegmentedTabs } from "@/components/ui/tabs";
import { UserIdentity } from "@/components/ui/userIdentity";
import { suspensionSourceOptions } from "@/constants/trustOptions.constant";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchSuspensionCases } from "@/services/safetyApi.service";
import type { SuspensionCaseSummary, SuspensionQueueFilters } from "@/types/suspensions.type";
import { formatRelativeTimeFromNow, humanizeConstantName } from "@/utils/formatting.util";

import { SuspendedAccountsPanel } from "./suspendedAccountsPanel";
import { SuspensionCasePanel } from "./suspensionCasePanel";
import styles from "./trustShared.module.css";

const tabs = [
  { key: "OPEN", label: "Needs a decision" },
  { key: "ACCOUNTS", label: "Suspended accounts" },
  { key: "APPEALS", label: "Appeals" },
  { key: "DECIDED", label: "Decided" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

const columns: readonly DataTableColumn<SuspensionCaseSummary>[] = [
  { key: "risk", header: "Risk", width: "72px", isMono: true, render: (item) => <StatusBadge label={String(item.riskScore)} tone={item.riskScore >= 80 ? "danger" : item.riskScore >= 60 ? "caution" : "neutral"} hasDot={false} /> },
  { key: "user", header: "Account", render: (item) => <UserIdentity user={item.user} size={24} /> },
  { key: "source", header: "Source", render: (item) => humanizeConstantName(item.source) },
  { key: "signals", header: "Top signals", render: (item) => item.topSignals.join(" · ") },
  { key: "reports", header: "Reports", align: "end", isMono: true, render: (item) => item.reportCount },
  { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} /> },
  { key: "age", header: "Opened", render: (item) => formatRelativeTimeFromNow(item.createdAt) },
];

function CaseQueue({ status }: { readonly status: "OPEN" | "DECIDED" }) {
  const [filters, setFilters] = useState<Omit<SuspensionQueueFilters, "status">>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const queryFilters = { ...filters, status };
  const { data, errorMessage, error: queryError, isLoading, reload } = useAdminQuery((signal) => fetchSuspensionCases(queryFilters, signal), JSON.stringify(queryFilters));
  return (
    <>
      <Toolbar>
        <div className={styles.filters}>
          <TextField label="Search" isLabelHidden type="search" placeholder="Search @username or case ID" value={filters.search ?? ""} onChange={(event) => setFilters({ ...filters, search: event.target.value || undefined, cursor: undefined })} />
          <SelectField label="Source" isLabelHidden options={suspensionSourceOptions} value={filters.source ?? ""} onChange={(event) => setFilters({ ...filters, source: event.target.value || undefined, cursor: undefined })} />
        </div>
      </Toolbar>
      {errorMessage ? <ErrorBlock error={queryError} message={errorMessage} onRetry={reload} /> : null}
      <DataTable caption="Suspension cases" columns={columns} rows={data?.items ?? []} readRowKey={(item) => item.id} onRowOpen={(item) => setSelectedId(item.id)} selectedRowKey={selectedId} isLoading={isLoading} readRowTone={(item) => (item.status === "ESCALATED" ? "danger" : item.riskScore >= 80 ? "caution" : null)} emptyMessage={status === "OPEN" ? "No suspension cases waiting." : "Nothing decided yet."} />
      <CursorPagination cursor={filters.cursor} nextCursor={data?.nextCursor} onCursorChange={(cursor) => setFilters({ ...filters, cursor })} />
      {selectedId ? <SuspensionCasePanel key={selectedId} caseId={selectedId} onClose={() => setSelectedId(null)} onChanged={reload} /> : null}
    </>
  );
}

export function SuspensionsWorkspace() {
  const [tab, setTab] = useState<TabKey>("OPEN");
  return (
    <>
      <PageHeader area="Trust & safety" title="Suspensions" description="Accounts the risk service or user reports suggest suspending. Only an admin can suspend, and every action needs your authenticator code." />
      <SegmentedTabs label="Suspension views" items={tabs} activeKey={tab} onChange={setTab} />
      {tab === "OPEN" ? <CaseQueue status="OPEN" /> : null}
      {tab === "DECIDED" ? <CaseQueue status="DECIDED" /> : null}
      {tab === "ACCOUNTS" ? <SuspendedAccountsPanel appealsOnly={false} /> : null}
      {tab === "APPEALS" ? <SuspendedAccountsPanel appealsOnly /> : null}
    </>
  );
}
