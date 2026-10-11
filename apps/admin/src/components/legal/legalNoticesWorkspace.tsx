"use client";

import { useEffect } from "react";

import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { ErrorBlock, NoticeBanner } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/pageHeader";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchLegalNotices } from "@/services/legalApi.service";
import type { LegalNoticeProgress } from "@/types/legal.type";
import { formatDateTime } from "@/utils/formatting.util";

import styles from "./legal.module.css";

function Progress({ notice }: { readonly notice: LegalNoticeProgress }) {
  const percent = notice.recipientCount === 0 ? 0 : Math.round((notice.sentCount / notice.recipientCount) * 100);
  return (
    <div className={styles.stack}>
      <div className={styles.progressTrack} role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={`${notice.subject} sending progress`}><div className={styles.progressFill} style={{ width: `${percent}%` }} /></div>
      <span className={styles.muted}>{notice.sentCount.toLocaleString()} of {notice.recipientCount.toLocaleString()} sent, batch {notice.batchesDone.toLocaleString()} of {notice.batchesTotal.toLocaleString()}</span>
    </div>
  );
}

const columns: readonly DataTableColumn<LegalNoticeProgress>[] = [
  { key: "subject", header: "Notice", render: (notice) => <><strong>{notice.subject}</strong><br /><span className={styles.muted}>v{notice.versionNumber}, queued by {notice.queuedByName}</span></> },
  { key: "status", header: "Status", render: (notice) => <StatusBadge status={notice.status} /> },
  { key: "progress", header: "Progress", width: "28%", render: (notice) => <Progress notice={notice} /> },
  { key: "skipped", header: "Skipped", render: (notice) => `${notice.excludedHardBounces.toLocaleString()} bounces, ${notice.excludedSuppressed.toLocaleString()} suppressed` },
  { key: "rate", header: "Throttle", render: (notice) => `${notice.ratePerSecond}/s, batches of ${notice.batchSize}` },
  { key: "queued", header: "Queued", render: (notice) => formatDateTime(notice.queuedAt) },
];

export function LegalNoticesWorkspace() {
  const { data, errorMessage, error: queryError, isLoading, reload } = useAdminQuery((signal) => fetchLegalNotices(signal), "legal-notices");
  const isSending = data?.items.some((notice) => notice.status !== "COMPLETED") ?? false;
  useEffect(() => {
    if (!isSending) return;
    const timer = setInterval(reload, 3000);
    return () => clearInterval(timer);
  }, [isSending, reload]);
  return (
    <>
      <PageHeader area="Legal" title="Policy notices" description="Policy updated emails to all users through AWS SES. They are legal notices, so they ignore marketing consent but never go to hard bounces or suppressed addresses." />
      <NoticeBanner tone="info" title="Queued on publish">Publishing Terms or Privacy (or any material change) queues the email automatically. Edit the email draft on the document page before publishing.</NoticeBanner>
      {errorMessage ? <ErrorBlock error={queryError} message={errorMessage} onRetry={reload} /> : null}
      <DataTable caption="Policy notices" columns={columns} rows={data?.items ?? []} readRowKey={(notice) => notice.id} isLoading={isLoading} emptyMessage="No notices yet." />
    </>
  );
}
