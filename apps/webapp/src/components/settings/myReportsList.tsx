"use client";

import { useQuery } from "@tanstack/react-query";

import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { chatReportsService } from "@/services/chatReports.service";
import type { ContentReportStatus } from "@/types/support.type";

import styles from "./myReportsList.module.css";
import { AppIcon } from "@/components/ui/appIcon";
import { ListRowsSkeleton } from "@/components/ui/pageSkeletons";

const statusLabels: Record<ContentReportStatus, string> = {
  received: "Received",
  reviewing: "In review",
  action_taken: "We took action",
  no_violation: "No violation found",
};

export function MyReportsList() {
  const reports = useQuery({ queryKey: ["reports", "mine"], queryFn: chatReportsService.listMyReports });
  if (reports.isLoading) return <ListRowsSkeleton label="Loading your reports" rows={4} withAvatar={false} />;
  if (reports.isError) return <ErrorState description="We couldn't load your reports." error={reports.error} onRetry={() => void reports.refetch()} />;
  if (!reports.data?.length) return <EmptyState icon={<AppIcon name="shield24" size={28} />} title="No reports" description="You haven't reported anything." />;
  return (
    <ul className={styles.list}>
      {reports.data.map((report) => (
        <li key={report.id} className={styles.row}>
          <div className={styles.top}>
            <strong>{report.targetLabel}</strong>
            <span className={styles.status}>{statusLabels[report.status]}</span>
          </div>
          <span className={styles.meta}>{report.reason} · reported {new Date(report.createdAt).toLocaleDateString()}</span>
          {report.outcomeNote ? <span>{report.outcomeNote}</span> : null}
        </li>
      ))}
    </ul>
  );
}
