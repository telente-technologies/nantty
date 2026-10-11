"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { ErrorBlock } from "@/components/ui/feedback";
import { Pagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchAutoTopicLog } from "@/services/helpContentApi.service";
import type { AutoTopicLogEntry } from "@/types/helpContent.type";
import { formatRelativeTimeFromNow, humanizeConstantName } from "@/utils/formatting.util";

import styles from "./helpContent.module.css";

const actionLabels: Record<AutoTopicLogEntry["action"], string> = { CREATED: "New topic", APPENDED: "Added as related question", PENDING_REVIEW: "Waiting for review", SKIPPED: "Skipped" };

const columns: DataTableColumn<AutoTopicLogEntry>[] = [
  { key: "ticket", header: "Ticket", render: (entry) => <code>{entry.ticketRef}</code>, width: "110px" },
  { key: "action", header: "Outcome", render: (entry) => <StatusBadge status={entry.action} label={actionLabels[entry.action]} /> },
  {
    key: "topic",
    header: "Topic",
    render: (entry) => (
      <span className={styles.titleCell}>
        <strong>{entry.topic?.title ?? "No topic"}</strong>
        <span className={styles.muted}>{entry.note}</span>
      </span>
    ),
  },
  { key: "status", header: "Topic status", render: (entry) => (entry.topic ? humanizeConstantName(entry.topic.status) : "—") },
  { key: "similarity", header: "Closest match", render: (entry) => `${Math.round(entry.similarity * 100)}%`, align: "end" },
  { key: "when", header: "When", render: (entry) => <span className={styles.muted}>{formatRelativeTimeFromNow(entry.createdAt)}</span> },
];

export function AutoTopicsPanel() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const log = useAdminQuery((signal) => fetchAutoTopicLog(page, signal), `auto-topics:${page}`);
  return (
    <>
      <p className={styles.muted}>Open a topic to edit, merge, unpublish or delete it.</p>
      {log.errorMessage ? <ErrorBlock error={log.error} message={log.errorMessage} onRetry={log.reload} /> : null}
      <DataTable
        caption="Topics generated from resolved tickets"
        columns={columns}
        rows={log.data?.items ?? []}
        readRowKey={(entry) => entry.id}
        onRowOpen={(entry) => (entry.topic ? router.push(`/support/help/${encodeURIComponent(entry.topic.id)}`) : undefined)}
        isLoading={log.isLoading}
        emptyMessage="No resolved tickets have been turned into topics yet."
      />
      {log.data ? <Pagination page={log.data.page} pageSize={log.data.pageSize} total={log.data.total} onPageChange={setPage} /> : null}
    </>
  );
}
