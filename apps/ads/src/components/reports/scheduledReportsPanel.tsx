"use client";

import { useState } from "react";

import { requestConfirmation } from "@zudomart/web-kit";

import { ScheduleReportDialog } from "@/components/reports/scheduleReportDialog";
import { useAdsSession } from "@/components/session/adsSessionProvider";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/feedback";
import { Card } from "@/components/ui/surfaces";
import { useToast } from "@/components/ui/toastProvider";
import { breakdownOptions } from "@/constants/reportOptions.constant";
import { useAdsQuery } from "@/hooks/useAdsQuery.hook";
import { readErrorMessageForDisplay } from "@/services/adsApiClient.service";
import { reportsApi } from "@/services/reportsApi.service";
import type { MetricKey, ReportBreakdown } from "@/types/report.type";
import { formatDateAndTime } from "@/utils/dateRange.util";

import styles from "./reportsPage.module.css";

const frequencyLabels = { daily: "Daily", weekly: "Weekly", monthly: "Monthly" } as const;

export function ScheduledReportsPanel({ accountId, breakdown, metrics }: { readonly accountId: string; readonly breakdown: ReportBreakdown; readonly metrics: readonly MetricKey[] }) {
  const session = useAdsSession();
  const { showToast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const scheduledQuery = useAdsQuery(() => reportsApi.listScheduledReports(accountId), `scheduled-${accountId}`);

  async function deleteScheduledReport(scheduledReportId: string, name: string) {
    if (!(await requestConfirmation({ title: `Stop sending "${name}"?`, description: "No more emails go out for this report.", confirmLabel: "Stop sending", tone: "danger", intent: "stop" }))) return;
    setDeletingId(scheduledReportId);
    try {
      await reportsApi.deleteScheduledReport(accountId, scheduledReportId);
      scheduledQuery.replaceData((current) => (current ? { ...current, items: current.items.filter((item) => item.id !== scheduledReportId), total: current.total - 1 } : current));
      showToast("Scheduled report stopped");
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Card title="Scheduled email reports" description="Sent as CSV attachments in the ad account's time zone." actions={<Button size="small" iconName="calendarDots16" onClick={() => setIsDialogOpen(true)}>Schedule report</Button>}>
      {scheduledQuery.errorMessage ? <ErrorState error={scheduledQuery.error} message={scheduledQuery.errorMessage} onRetry={scheduledQuery.reload} /> : null}
      {scheduledQuery.data && scheduledQuery.data.items.length === 0 ? <p className={styles.quietText}>No scheduled reports yet.</p> : null}
      <ul className={styles.scheduledList}>
        {(scheduledQuery.data?.items ?? []).map((report) => (
          <li key={report.id} className={styles.scheduledItem}>
            <div className={styles.scheduledText}>
              <p className={styles.scheduledName}>{report.name}</p>
              <p className={styles.quietText}>
                {frequencyLabels[report.frequency]} · by {breakdownOptions.find((option) => option.breakdown === report.breakdown)?.label.toLowerCase()} · next {formatDateAndTime(report.nextSendAt)}
              </p>
              <p className={styles.quietText}>To {report.recipients.join(", ")}</p>
            </div>
            <Button size="small" variant="ghost" iconName="trash24" aria-label={`Stop sending ${report.name}`} isLoading={deletingId === report.id} onClick={() => deleteScheduledReport(report.id, report.name)} />
          </li>
        ))}
      </ul>
      {isDialogOpen ? (
        <ScheduleReportDialog
          accountId={accountId}
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          onCreated={(created) => scheduledQuery.replaceData((current) => (current ? { ...current, items: [...current.items, created], total: current.total + 1 } : current))}
          initialBreakdown={breakdown}
          initialMetrics={metrics}
          defaultRecipient={session?.user.email ?? null}
        />
      ) : null}
    </Card>
  );
}
