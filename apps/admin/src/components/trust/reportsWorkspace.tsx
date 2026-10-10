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
import { reportPriorityOptions, reportReasonOptions, reportTargetTypeOptions } from "@/constants/trustOptions.constant";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchModerationReports, type ReportQueueFilters } from "@/services/trustApi.service";
import type { ReportSummary } from "@/types/moderation.type";
import { humanizeConstantName } from "@/utils/formatting.util";

import { DueTimeLabel, ModeratedTargetTableCell } from "./moderatedTargetPreview";
import { ReportDetailPanel } from "./reportDetailPanel";
import styles from "./trustShared.module.css";

const statusTabs = [
  { key: "OPEN", label: "Needs review" },
  { key: "RESOLVED", label: "Actioned" },
  { key: "DISMISSED", label: "Dismissed" },
  { key: "ALL", label: "All" },
] as const;

type StatusTabKey = (typeof statusTabs)[number]["key"];

const reportColumns: readonly DataTableColumn<ReportSummary>[] = [
  { key: "priority", header: "Priority", width: "96px", render: (report) => <StatusBadge status={report.priority} /> },
  { key: "target", header: "Reported content", render: (report) => <ModeratedTargetTableCell target={report.target} /> },
  { key: "author", header: "Author", render: (report) => <UserIdentity user={report.author} size={24} /> },
  { key: "reason", header: "Top reason", render: (report) => humanizeConstantName(report.primaryReason) },
  { key: "count", header: "Reports", align: "end", isMono: true, render: (report) => report.reportCount },
  { key: "status", header: "Status", render: (report) => <StatusBadge status={report.status} /> },
  { key: "sla", header: "SLA", render: (report) => <DueTimeLabel dueAt={report.slaDueAt} isOpen={report.status === "OPEN" || report.status === "IN_REVIEW"} /> },
];

export function ReportsWorkspace() {
  const [statusTab, setStatusTab] = useState<StatusTabKey>("OPEN");
  const [filters, setFilters] = useState<Omit<ReportQueueFilters, "status">>({});
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const queryFilters: ReportQueueFilters = { ...filters, status: statusTab };
  const { data, errorMessage, isLoading, reload } = useAdminQuery((signal) => fetchModerationReports(queryFilters, signal), JSON.stringify(queryFilters));

  function updateFilter(name: keyof ReportQueueFilters, value: string) {
    setFilters((current) => ({ ...current, [name]: value || undefined, cursor: undefined }));
  }

  return (
    <>
      <PageHeader area="Trust & safety" title="Reports" description="Reported posts, comments, clips, lives, profiles, products and messages. Highest priority and oldest first." />
      <SegmentedTabs label="Report status" items={statusTabs} activeKey={statusTab} onChange={(key) => { setStatusTab(key); setFilters((current) => ({ ...current, cursor: undefined })); }} />
      <Toolbar>
        <div className={styles.filters}>
          <TextField label="Search" isLabelHidden placeholder="Search content, @author or report ID" value={filters.search ?? ""} onChange={(event) => updateFilter("search", event.target.value)} type="search" />
          <SelectField label="Content type" isLabelHidden options={reportTargetTypeOptions} value={filters.targetType ?? ""} onChange={(event) => updateFilter("targetType", event.target.value)} />
          <SelectField label="Reason" isLabelHidden options={reportReasonOptions} value={filters.reason ?? ""} onChange={(event) => updateFilter("reason", event.target.value)} />
          <SelectField label="Priority" isLabelHidden options={reportPriorityOptions} value={filters.priority ?? ""} onChange={(event) => updateFilter("priority", event.target.value)} />
        </div>
      </Toolbar>
      {errorMessage ? <ErrorBlock message={errorMessage} onRetry={reload} /> : null}
      <DataTable
        caption="Reports queue"
        columns={reportColumns}
        rows={data?.items ?? []}
        readRowKey={(report) => report.id}
        onRowOpen={(report) => setSelectedReportId(report.id)}
        selectedRowKey={selectedReportId}
        isLoading={isLoading}
        readRowTone={(report) => (report.priority === "URGENT" ? "danger" : report.priority === "HIGH" ? "caution" : null)}
        emptyMessage={statusTab === "OPEN" ? "Queue is clear. Nice work." : "No reports match these filters."}
      />
      <CursorPagination cursor={filters.cursor} nextCursor={data?.nextCursor} onCursorChange={(cursor) => setFilters((current) => ({ ...current, cursor }))} />
      {selectedReportId ? <ReportDetailPanel key={selectedReportId} reportId={selectedReportId} onClose={() => setSelectedReportId(null)} onReportChanged={reload} /> : null}
    </>
  );
}
