"use client";

import { useState } from "react";

import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { ErrorBlock } from "@/components/ui/feedback";
import { SelectField, TextField } from "@/components/ui/formFields";
import { PageHeader } from "@/components/ui/pageHeader";
import { Pagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Toolbar } from "@/components/ui/surfaces";
import { SegmentedTabs } from "@/components/ui/tabs";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchLiveIncidents, type LiveIncidentQueueFilters } from "@/services/liveIncidentsApi.service";
import type { LiveIncidentSummary } from "@/types/liveIncident.type";
import { formatRelativeTimeFromNow, humanizeConstantName } from "@/utils/formatting.util";

import { LiveIncidentDetailPanel } from "./liveIncidentDetailPanel";
import styles from "./liveIncidents.module.css";

const statusTabs = [
  { key: "open", label: "Needs review" },
  { key: "closed", label: "Closed" },
  { key: "all", label: "All" },
] as const;

type StatusTabKey = (typeof statusTabs)[number]["key"];

const priorityOptions = [
  { value: "", label: "Any priority" },
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "normal", label: "Normal" },
  { value: "low", label: "Low" },
];

function describeState(incident: LiveIncidentSummary): string {
  if (incident.hashMatch) return "Restricted";
  if (incident.holdActive) return "Paused";
  if (incident.liveEnded) return "Ended";
  return "On air";
}

const columns: readonly DataTableColumn<LiveIncidentSummary>[] = [
  { key: "priority", header: "Priority", width: "96px", render: (incident) => <StatusBadge status={incident.priority.toUpperCase()} /> },
  {
    key: "preview", header: "Latest frame", width: "96px",
    render: (incident) => (incident.latestFrameUrl ? <img src={incident.latestFrameUrl} alt="" className={styles.thumb} loading="lazy" referrerPolicy="no-referrer" /> : <span className={styles.thumbPlaceholder} aria-hidden />),
  },
  { key: "host", header: "Host", render: (incident) => (incident.host.username ? `@${incident.host.username}` : incident.host.id) },
  { key: "state", header: "State", render: (incident) => <StatusBadge label={describeState(incident)} tone={incident.holdActive || incident.hashMatch ? "danger" : "neutral"} /> },
  { key: "signal", header: "Top signal", render: (incident) => (incident.topCategory ? `${humanizeConstantName(incident.topCategory)} ${Math.round(incident.topConfidence * 100)}%` : "Reports only") },
  { key: "reports", header: "Reports", align: "end", isMono: true, render: (incident) => incident.reportCount },
  { key: "appeal", header: "Appeal", render: (incident) => (incident.appealed ? <StatusBadge label="Appealed" tone="info" hasDot={false} /> : null) },
  { key: "age", header: "Opened", render: (incident) => formatRelativeTimeFromNow(incident.createdAt) },
];

export function LiveIncidentsWorkspace() {
  const [statusTab, setStatusTab] = useState<StatusTabKey>("open");
  const [filters, setFilters] = useState<Omit<LiveIncidentQueueFilters, "status">>({ page: 1 });
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const queryFilters: LiveIncidentQueueFilters = { ...filters, status: statusTab };
  const { data, errorMessage, error: queryError, isLoading, reload } = useAdminQuery((signal) => fetchLiveIncidents(queryFilters, signal), JSON.stringify(queryFilters));

  return (
    <>
      <PageHeader area="Trust & safety" title="Live incidents" description="Lives flagged by automated checks or viewer reports. Urgent and paused lives first. Automation only pauses; you decide the outcome." />
      <SegmentedTabs label="Incident status" items={statusTabs} activeKey={statusTab} onChange={(key) => { setStatusTab(key); setFilters((current) => ({ ...current, page: 1 })); }} />
      <Toolbar>
        <div className={styles.filters}>
          <TextField label="Search" isLabelHidden placeholder="Search by live ID" value={filters.search ?? ""} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value || undefined, page: 1 }))} type="search" />
          <SelectField label="Priority" isLabelHidden options={priorityOptions} value={filters.priority ?? ""} onChange={(event) => setFilters((current) => ({ ...current, priority: event.target.value || undefined, page: 1 }))} />
        </div>
      </Toolbar>
      {errorMessage ? <ErrorBlock error={queryError} message={errorMessage} onRetry={reload} /> : null}
      <DataTable
        caption="Live incidents queue"
        columns={columns}
        rows={data?.items ?? []}
        readRowKey={(incident) => incident.id}
        onRowOpen={(incident) => setSelectedIncidentId(incident.id)}
        selectedRowKey={selectedIncidentId}
        isLoading={isLoading}
        readRowTone={(incident) => (incident.priority === "urgent" || incident.holdActive ? "danger" : incident.priority === "high" ? "caution" : null)}
        emptyMessage={statusTab === "open" ? "No live needs review right now." : "No incidents match these filters."}
      />
      {data ? <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={(page) => setFilters((current) => ({ ...current, page }))} /> : null}
      {selectedIncidentId ? <LiveIncidentDetailPanel key={selectedIncidentId} incidentId={selectedIncidentId} onClose={() => setSelectedIncidentId(null)} onIncidentChanged={reload} /> : null}
    </>
  );
}
