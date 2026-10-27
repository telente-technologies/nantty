"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { useAdminPermissions } from "@/components/session/adminSessionProvider";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { ErrorBlock } from "@/components/ui/feedback";
import { SelectField, TextField } from "@/components/ui/formFields";
import { PageHeader } from "@/components/ui/pageHeader";
import { CursorPagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Toolbar } from "@/components/ui/surfaces";
import { useToast } from "@/components/ui/toastProvider";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { readErrorMessageForDisplay, saveBlobAsDownloadedFile } from "@/services/adminApiClient.service";
import { downloadAuditLogCsv, fetchAuditFacets, fetchAuditLog, type AuditLogFilters } from "@/services/platformApi.service";
import type { AuditLogEntry } from "@/types/audit.type";
import { formatDateTime, humanizeConstantName } from "@/utils/formatting.util";

import { AuditEntryPanel } from "./auditEntryPanel";

const columns: readonly DataTableColumn<AuditLogEntry>[] = [
  { key: "when", header: "When", render: (entry) => formatDateTime(entry.occurredAt), width: "150px", isMono: true },
  { key: "who", header: "Who", render: (entry) => entry.actor.name, width: "150px" },
  { key: "action", header: "Action", render: (entry) => <code>{entry.action}</code> },
  { key: "target", header: "Target", render: (entry) => entry.target.label },
  { key: "reason", header: "Reason", render: (entry) => <span title={entry.reason ?? ""}>{(entry.reason ?? "—").slice(0, 60)}{(entry.reason?.length ?? 0) > 60 ? "…" : ""}</span> },
  { key: "stepUp", header: "Step-up", render: (entry) => (entry.stepUpVerified ? <StatusBadge label="Yes" tone="night" hasDot={false} /> : null), width: "80px" },
];

function convertDateInputToIso(dateText: string, isEndOfDay: boolean): string | undefined {
  if (!dateText) return undefined;
  return new Date(`${dateText}T${isEndOfDay ? "23:59:59" : "00:00:00"}`).toISOString();
}

export function AuditLogWorkspace() {
  const searchParams = useSearchParams();
  const { can } = useAdminPermissions();
  const { showToast } = useToast();
  const [search, setSearch] = useState("");
  const [area, setArea] = useState("");
  const [actorId, setActorId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [action, setAction] = useState("");
  const [targetId, setTargetId] = useState(searchParams.get("targetId") ?? "");
  const [requestId, setRequestId] = useState("");
  const [stepUpOnly, setStepUpOnly] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>();
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const filters: AuditLogFilters = { search, area, actorId, from: convertDateInputToIso(fromDate, false), to: convertDateInputToIso(toDate, true), targetType: searchParams.get("targetType") ?? undefined, targetId: targetId.trim() || undefined, action: action.trim() || undefined, requestId: requestId.trim() || undefined, stepUp: stepUpOnly || undefined, cursor };
  const list = useAdminQuery((signal) => fetchAuditLog(filters, signal), JSON.stringify(filters));
  const facets = useAdminQuery((signal) => fetchAuditFacets(signal), "facets");

  async function exportCsv() {
    setIsExporting(true);
    try {
      saveBlobAsDownloadedFile(await downloadAuditLogCsv({ ...filters, cursor: undefined }), `nantty-audit-${new Date().toISOString().slice(0, 10)}.csv`);
      showToast("Export downloaded. The export itself was recorded in the audit log.");
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setIsExporting(false);
    }
  }

  const resetToFirstPage = <Value,>(setter: (value: Value) => void) => (value: Value) => {
    setter(value);
    setCursor(undefined);
  };

  return (
    <>
      <PageHeader
        area="Platform"
        title="Audit log"
        description="Every admin action with who, what, when, why, and the exact before and after. Read-only."
        actions={can("audit:export") ? <Button iconName="export24" onClick={exportCsv} isBusy={isExporting}>Export CSV</Button> : null}
      />
      <Toolbar>
        <TextField label="Search" isLabelHidden placeholder="Search action, admin, target or reason" value={search} onChange={(event) => resetToFirstPage(setSearch)(event.target.value)} />
        <SelectField label="Area" isLabelHidden value={area} onChange={(event) => resetToFirstPage(setArea)(event.target.value)} options={[{ value: "", label: "All areas" }, ...(facets.data?.areas ?? []).map((value) => ({ value, label: humanizeConstantName(value) }))]} />
        <SelectField label="Admin" isLabelHidden value={actorId} onChange={(event) => resetToFirstPage(setActorId)(event.target.value)} options={[{ value: "", label: "All admins" }, ...(facets.data?.actors ?? []).map((actor) => ({ value: actor.id, label: actor.name }))]} />
        <TextField label="From" type="date" value={fromDate} onChange={(event) => resetToFirstPage(setFromDate)(event.target.value)} />
        <TextField label="To" type="date" value={toDate} onChange={(event) => resetToFirstPage(setToDate)(event.target.value)} />
        <TextField label="Action" isLabelHidden placeholder="Exact action, e.g. user.banned" value={action} onChange={(event) => resetToFirstPage(setAction)(event.target.value)} />
        <TextField label="Target ID" isLabelHidden placeholder="Target ID" value={targetId} onChange={(event) => resetToFirstPage(setTargetId)(event.target.value)} />
        <TextField label="Request ID" isLabelHidden placeholder="Request ID" value={requestId} onChange={(event) => resetToFirstPage(setRequestId)(event.target.value)} />
        <SelectField label="Step-up" isLabelHidden value={stepUpOnly ? "yes" : ""} onChange={(event) => resetToFirstPage(setStepUpOnly)(event.target.value === "yes")} options={[{ value: "", label: "All actions" }, { value: "yes", label: "Step-up actions only" }]} />
      </Toolbar>
      {list.errorMessage ? <ErrorBlock error={list.error} message={list.errorMessage} onRetry={list.reload} /> : null}
      <DataTable caption="Audit log entries" columns={columns} rows={list.data?.items ?? []} readRowKey={(entry) => entry.id} isLoading={list.isLoading} onRowOpen={setSelectedEntry} selectedRowKey={selectedEntry?.id ?? null} emptyMessage="No entries match these filters." />
      <CursorPagination cursor={cursor} nextCursor={list.data?.nextCursor} onCursorChange={setCursor} />
      {selectedEntry ? <AuditEntryPanel entry={selectedEntry} onClose={() => setSelectedEntry(null)} /> : null}
    </>
  );
}
