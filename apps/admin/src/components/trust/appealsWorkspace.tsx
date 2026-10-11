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
import { appealDecisionTypeOptions } from "@/constants/trustOptions.constant";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchModerationAppeals, type AppealQueueFilters } from "@/services/trustApi.service";
import type { AppealSummary } from "@/types/moderation.type";
import { formatRelativeTimeFromNow, humanizeConstantName } from "@/utils/formatting.util";

import { AppealDetailPanel } from "./appealDetailPanel";
import { DueTimeLabel, ModeratedTargetTableCell } from "./moderatedTargetPreview";
import styles from "./trustShared.module.css";

const statusTabs = [
  { key: "PENDING", label: "Waiting" },
  { key: "OVERTURNED", label: "Overturned" },
  { key: "UPHELD", label: "Upheld" },
  { key: "ALL", label: "All" },
] as const;

const appealColumns: readonly DataTableColumn<AppealSummary>[] = [
  { key: "appellant", header: "Appellant", render: (appeal) => <UserIdentity user={appeal.appellant} size={24} /> },
  { key: "decision", header: "Appealing", render: (appeal) => humanizeConstantName(appeal.decisionType) },
  { key: "target", header: "Content", render: (appeal) => <ModeratedTargetTableCell target={appeal.target} /> },
  { key: "decidedBy", header: "Original decision by", render: (appeal) => appeal.originalDecision.decidedByName },
  { key: "submitted", header: "Submitted", render: (appeal) => formatRelativeTimeFromNow(appeal.submittedAt) },
  { key: "status", header: "Status", render: (appeal) => <StatusBadge status={appeal.status} /> },
  { key: "sla", header: "SLA", render: (appeal) => <DueTimeLabel dueAt={appeal.slaDueAt} isOpen={appeal.status === "PENDING"} /> },
];

export function AppealsWorkspace() {
  const [statusTab, setStatusTab] = useState<(typeof statusTabs)[number]["key"]>("PENDING");
  const [filters, setFilters] = useState<Omit<AppealQueueFilters, "status">>({});
  const [selectedAppealId, setSelectedAppealId] = useState<string | null>(null);
  const queryFilters: AppealQueueFilters = { ...filters, status: statusTab };
  const { data, errorMessage, error: queryError, isLoading, reload } = useAdminQuery((signal) => fetchModerationAppeals(queryFilters, signal), JSON.stringify(queryFilters));

  return (
    <>
      <PageHeader area="Trust & safety" title="Appeals" description="People asking us to look again at removals, strikes and suspensions. Decide within 48 hours." />
      <SegmentedTabs label="Appeal status" items={statusTabs} activeKey={statusTab} onChange={(key) => { setStatusTab(key); setFilters((current) => ({ ...current, cursor: undefined })); }} />
      <Toolbar>
        <div className={styles.filters}>
          <TextField label="Search" isLabelHidden type="search" placeholder="Search @username, statement or appeal ID" value={filters.search ?? ""} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value || undefined, cursor: undefined }))} />
          <SelectField label="Decision type" isLabelHidden options={appealDecisionTypeOptions} value={filters.decisionType ?? ""} onChange={(event) => setFilters((current) => ({ ...current, decisionType: event.target.value || undefined, cursor: undefined }))} />
        </div>
      </Toolbar>
      {errorMessage ? <ErrorBlock error={queryError} message={errorMessage} onRetry={reload} /> : null}
      <DataTable caption="Appeals queue" columns={appealColumns} rows={data?.items ?? []} readRowKey={(appeal) => appeal.id} onRowOpen={(appeal) => setSelectedAppealId(appeal.id)} selectedRowKey={selectedAppealId} isLoading={isLoading} emptyMessage="No appeals waiting." />
      <CursorPagination cursor={filters.cursor} nextCursor={data?.nextCursor} onCursorChange={(cursor) => setFilters((current) => ({ ...current, cursor }))} />
      {selectedAppealId ? <AppealDetailPanel key={selectedAppealId} appealId={selectedAppealId} onClose={() => setSelectedAppealId(null)} onAppealChanged={reload} /> : null}
    </>
  );
}
