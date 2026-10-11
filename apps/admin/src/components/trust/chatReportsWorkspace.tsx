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
import { chatReportPriorityOptions, chatReportReasonOptions, chatReportTargetTypeOptions } from "@/constants/chatReportOptions.constant";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchChatReports, type ChatReportQueueFilters } from "@/services/chatReportsApi.service";
import type { ChatReportSummary } from "@/types/chatReport.type";
import { humanizeConstantName } from "@/utils/formatting.util";

import { ChatEvidenceRetentionCard } from "./chatEvidenceRetentionCard";
import { ChatReportDetailPanel } from "./chatReportDetailPanel";
import { DueTimeLabel } from "./moderatedTargetPreview";
import styles from "./trustShared.module.css";

const statusTabs = [
  { key: "OPEN", label: "Needs review" },
  { key: "ACTIONED", label: "Actioned" },
  { key: "DISMISSED", label: "Dismissed" },
  { key: "ESCALATED_LEGAL", label: "Legal" },
  { key: "ALL", label: "All" },
] as const;

type StatusTabKey = (typeof statusTabs)[number]["key"];

const chatReportColumns: readonly DataTableColumn<ChatReportSummary>[] = [
  { key: "priority", header: "Priority", width: "110px", render: (report) => <StatusBadge status={report.priority} label={report.reason === "CHILD_SAFETY" ? "Urgent · child safety" : undefined} /> },
  { key: "type", header: "Report", render: (report) => `${humanizeConstantName(report.targetType)} · ${report.conversationLabel}` },
  { key: "reason", header: "Reason", render: (report) => humanizeConstantName(report.reason) },
  { key: "reporter", header: "Reporter", render: (report) => <UserIdentity user={report.reporter} size={24} /> },
  { key: "reported", header: "Reported", render: (report) => (report.reportedUser ? <UserIdentity user={report.reportedUser} size={24} /> : "Group") },
  { key: "evidence", header: "Messages", align: "end", isMono: true, render: (report) => report.evidenceCount },
  { key: "spam", header: "Spam score", align: "end", isMono: true, render: (report) => (report.spamScore ? `${Math.round(report.spamScore.score * 100)}%` : "–") },
  { key: "status", header: "Status", render: (report) => <StatusBadge status={report.status} /> },
  { key: "sla", header: "SLA", render: (report) => <DueTimeLabel dueAt={report.slaDueAt} isOpen={report.status === "OPEN" || report.status === "IN_REVIEW"} /> },
];

export function ChatReportsWorkspace() {
  const [statusTab, setStatusTab] = useState<StatusTabKey>("OPEN");
  const [filters, setFilters] = useState<Omit<ChatReportQueueFilters, "status">>({});
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const queryFilters: ChatReportQueueFilters = { ...filters, status: statusTab };
  const { data, errorMessage, error: queryError, isLoading, reload } = useAdminQuery((signal) => fetchChatReports(queryFilters, signal), JSON.stringify(queryFilters));

  function updateFilter(name: keyof ChatReportQueueFilters, value: string) {
    setFilters((current) => ({ ...current, [name]: value || undefined, cursor: undefined }));
  }

  return (
    <>
      <PageHeader area="Trust & safety" title="Chat reports" description="Chats are end-to-end encrypted. You only see the messages the reporter chose to send. Child-safety reports are always first." />
      <ChatEvidenceRetentionCard />
      <SegmentedTabs label="Chat report status" items={statusTabs} activeKey={statusTab} onChange={(key) => { setStatusTab(key); setFilters((current) => ({ ...current, cursor: undefined })); }} />
      <Toolbar>
        <div className={styles.filters}>
          <TextField label="Search" isLabelHidden placeholder="Search report ID, chat or details" value={filters.search ?? ""} onChange={(event) => updateFilter("search", event.target.value)} type="search" />
          <SelectField label="Report type" isLabelHidden options={chatReportTargetTypeOptions} value={filters.targetType ?? ""} onChange={(event) => updateFilter("targetType", event.target.value)} />
          <SelectField label="Reason" isLabelHidden options={chatReportReasonOptions} value={filters.reason ?? ""} onChange={(event) => updateFilter("reason", event.target.value)} />
          <SelectField label="Priority" isLabelHidden options={chatReportPriorityOptions} value={filters.priority ?? ""} onChange={(event) => updateFilter("priority", event.target.value)} />
        </div>
      </Toolbar>
      {errorMessage ? <ErrorBlock error={queryError} message={errorMessage} onRetry={reload} /> : null}
      <DataTable
        caption="Chat reports queue"
        columns={chatReportColumns}
        rows={data?.items ?? []}
        readRowKey={(report) => report.id}
        onRowOpen={(report) => setSelectedReportId(report.id)}
        selectedRowKey={selectedReportId}
        isLoading={isLoading}
        emptyMessage={statusTab === "OPEN" ? "Queue is clear. Nice work." : "No chat reports match these filters."}
      />
      <CursorPagination cursor={filters.cursor} nextCursor={data?.nextCursor} onCursorChange={(cursor) => setFilters((current) => ({ ...current, cursor }))} />
      {selectedReportId ? <ChatReportDetailPanel key={selectedReportId} reportId={selectedReportId} onClose={() => setSelectedReportId(null)} onReportChanged={reload} /> : null}
    </>
  );
}
