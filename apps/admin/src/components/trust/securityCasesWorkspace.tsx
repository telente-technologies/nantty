"use client";

import { useState } from "react";

import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { ErrorBlock } from "@/components/ui/feedback";
import { SelectField } from "@/components/ui/formFields";
import { PageHeader } from "@/components/ui/pageHeader";
import { CursorPagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Toolbar } from "@/components/ui/surfaces";
import { SegmentedTabs } from "@/components/ui/tabs";
import { UserIdentity } from "@/components/ui/userIdentity";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchSecurityCases } from "@/services/securityCasesApi.service";
import type { SecurityCaseFilters, SecurityCaseSeverity, SecurityCaseSummary, SecurityCaseTrigger } from "@/types/securityCases.type";
import { formatRelativeTimeFromNow, humanizeConstantName } from "@/utils/formatting.util";

import { SecurityCasePanel } from "./securityCasePanel";
import styles from "./trustShared.module.css";

const tabs = [{ key: "open", label: "Needs a decision" }, { key: "decided", label: "Decided" }, { key: "all", label: "All" }] as const;
const triggerOptions = [{ value: "", label: "All triggers" }, { value: "access_probing", label: "Unauthorised access probing" }, { value: "suspected_bot", label: "Suspected bot" }];
const severityOptions = [{ value: "", label: "All severities" }, { value: "high", label: "High" }, { value: "medium", label: "Medium" }, { value: "low", label: "Low" }];
const severityTone = { high: "danger", medium: "caution", low: "neutral" } as const;

const columns: readonly DataTableColumn<SecurityCaseSummary>[] = [
  { key: "severity", header: "Severity", width: "96px", render: (item) => <StatusBadge label={humanizeConstantName(item.severity)} tone={severityTone[item.severity]} hasDot={false} /> },
  { key: "account", header: "Account", render: (item) => <UserIdentity user={item.account} size={24} /> },
  { key: "trigger", header: "Trigger", render: (item) => humanizeConstantName(item.trigger) },
  { key: "violations", header: "Violations", align: "end", isMono: true, render: (item) => item.violationCount },
  { key: "checks", header: "Checks passed/failed", align: "end", isMono: true, render: (item) => `${item.passedChallengeCount}/${item.failedChallengeCount}` },
  { key: "status", header: "Status", render: (item) => <StatusBadge label={item.autoSuspended && item.status === "open" ? "Auto-suspended" : humanizeConstantName(item.status)} tone={item.autoSuspended && item.status === "open" ? "danger" : item.status === "open" ? "caution" : "neutral"} /> },
  { key: "activity", header: "Last activity", render: (item) => formatRelativeTimeFromNow(item.lastActivityAt) },
];

export function SecurityCasesWorkspace() {
  const [status, setStatus] = useState<"open" | "decided" | "all">("open");
  const [filters, setFilters] = useState<Omit<SecurityCaseFilters, "status">>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const queryFilters: SecurityCaseFilters = { ...filters, status };
  const { data, errorMessage, error: queryError, isLoading, reload } = useAdminQuery((signal) => fetchSecurityCases(queryFilters, signal), JSON.stringify(queryFilters));
  return (
    <>
      <PageHeader area="Trust & safety" title="Security cases" description="Accounts flagged for probing other people's data or behaving like bots. Automation challenges and can suspend temporarily; bans and deletions are decided here, with your authenticator code." />
      <SegmentedTabs label="Security case views" items={tabs} activeKey={status} onChange={(key) => { setStatus(key); setFilters({}); }} />
      <Toolbar>
        <div className={styles.filters}>
          <SelectField label="Trigger" isLabelHidden options={triggerOptions} value={filters.trigger ?? ""} onChange={(event) => setFilters({ ...filters, trigger: (event.target.value || undefined) as SecurityCaseTrigger | undefined, cursor: undefined })} />
          <SelectField label="Severity" isLabelHidden options={severityOptions} value={filters.severity ?? ""} onChange={(event) => setFilters({ ...filters, severity: (event.target.value || undefined) as SecurityCaseSeverity | undefined, cursor: undefined })} />
        </div>
      </Toolbar>
      {errorMessage ? <ErrorBlock error={queryError} message={errorMessage} onRetry={reload} /> : null}
      <DataTable caption="Security cases" columns={columns} rows={data?.items ?? []} readRowKey={(item) => item.id} onRowOpen={(item) => setSelectedId(item.id)} selectedRowKey={selectedId} isLoading={isLoading} emptyMessage={status === "open" ? "No security cases waiting." : "Nothing here yet."} />
      <CursorPagination cursor={filters.cursor} nextCursor={data?.nextCursor} onCursorChange={(cursor) => setFilters({ ...filters, cursor })} />
      {selectedId ? <SecurityCasePanel key={selectedId} caseId={selectedId} onClose={() => setSelectedId(null)} onChanged={reload} /> : null}
    </>
  );
}
