"use client";

import Link from "next/link";
import { useState } from "react";

import { AuditHistoryList } from "@/components/audit/auditHistoryList";
import { useAdminPermissions } from "@/components/session/adminSessionProvider";
import { Button } from "@/components/ui/button";
import { ErrorBlock, LoadingBlock, NoticeBanner } from "@/components/ui/feedback";
import { SidePanel } from "@/components/ui/sidePanel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { KeyValueList, SectionHeading } from "@/components/ui/surfaces";
import { useToast } from "@/components/ui/toastProvider";
import { UserIdentity } from "@/components/ui/userIdentity";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchModerationReportDetail } from "@/services/trustApi.service";
import type { ModerationAction, ReportDetail } from "@/types/moderation.type";
import { formatDateTime, formatRelativeTimeFromNow, humanizeConstantName } from "@/utils/formatting.util";

import { ClassifierScoreBars, DueTimeLabel, ModeratedTargetPreviewCard } from "./moderatedTargetPreview";
import { ReportActionDialog, reportActionPresentations } from "./reportActionDialog";
import styles from "./trustShared.module.css";

const contentActionOrder: readonly ModerationAction[] = ["DISMISS", "HIDE", "RESTRICT", "REMOVE", "WARN_AUTHOR", "SUSPEND_AUTHOR", "REVOKE_AUTHOR_VERIFICATION"];

export function ReportDetailPanel({ reportId, onClose, onReportChanged }: { readonly reportId: string | null; readonly onClose: () => void; readonly onReportChanged: () => void }) {
  const { data: report, errorMessage, error: queryError, isLoading, reload, replaceData } = useAdminQuery((signal) => fetchModerationReportDetail(reportId ?? "", signal), reportId ?? "", reportId !== null);
  const [pendingAction, setPendingAction] = useState<ModerationAction | null>(null);
  const { can } = useAdminPermissions();
  const { showToast } = useToast();
  const isOpenReport = report?.status === "OPEN" || report?.status === "IN_REVIEW";
  const hasActiveVerification = report?.author.verification && report.author.verification.status !== "REVOKED";
  const availableActions = contentActionOrder.filter((action) => action !== "REVOKE_AUTHOR_VERIFICATION" || (hasActiveVerification && can("verification:revoke")));

  function handleActionCompleted(updated: ReportDetail, action: ModerationAction) {
    replaceData(() => updated);
    setPendingAction(null);
    showToast(`${reportActionPresentations[action].confirmLabel}: done. Logged to the audit trail.`);
    onReportChanged();
  }

  return (
    <SidePanel
      isOpen={reportId !== null}
      onClose={onClose}
      width="wide"
      title={report ? `${humanizeConstantName(report.target.type)} report · ${report.reportCount} reports` : "Report"}
      subtitle={report ? <>{report.id} · first reported {formatRelativeTimeFromNow(report.firstReportedAt)} · <DueTimeLabel dueAt={report.slaDueAt} isOpen={isOpenReport} /></> : null}
      footer={
        report && isOpenReport
          ? availableActions.map((action) => (
              <Button key={action} size="small" variant={reportActionPresentations[action].isDestructive ? "quietDanger" : action === "DISMISS" ? "ghost" : "secondary"} iconName={reportActionPresentations[action].requiresStepUp ? "shield24" : undefined} onClick={() => setPendingAction(action)}>
                {reportActionPresentations[action].confirmLabel}
              </Button>
            ))
          : null
      }
    >
      {errorMessage ? <ErrorBlock error={queryError} message={errorMessage} onRetry={reload} /> : null}
      {isLoading && !report ? <LoadingBlock /> : null}
      {report ? (
        <>
          {report.decision ? (
            <NoticeBanner tone={report.status === "DISMISSED" ? "info" : "success"} title={`${humanizeConstantName(report.decision.action)} by ${report.decision.decidedByName}`}>
              {report.decision.reason} · {formatDateTime(report.decision.decidedAt)}
              {report.decision.suspensionDays ? ` · ${report.decision.suspensionDays}-day suspension` : ""}
            </NoticeBanner>
          ) : null}
          <ModeratedTargetPreviewCard target={report.target} />
          <div className={styles.section}>
            <SectionHeading actions={<Link href={`/users/${report.author.id}`}>Open profile</Link>}>Author</SectionHeading>
            <UserIdentity user={report.author} size={36} />
            <KeyValueList columns={3} items={[
              { label: "Account", value: <StatusBadge status={report.author.status} /> },
              { label: "Strikes", value: report.author.strikeCount },
              { label: "Risk", value: <StatusBadge status={report.author.riskLevel} /> },
            ]} />
          </div>
          <div className={styles.section}>
            <SectionHeading>Why people reported it</SectionHeading>
            <div className={styles.reasonChips}>
              {report.reasonCounts.map((entry) => (
                <StatusBadge key={entry.reason} label={`${humanizeConstantName(entry.reason)} × ${entry.count}`} tone={entry.reason === report.primaryReason ? "danger" : "neutral"} hasDot={false} />
              ))}
              <StatusBadge status={report.priority} label={`${humanizeConstantName(report.priority)} priority`} />
            </div>
            {report.reporterNotes.length > 0 ? (
              <ul className={styles.plainList}>
                {report.reporterNotes.map((note) => (
                  <li key={`${note.reporterUsername}-${note.reportedAt}`} className={styles.noteItem}>
                    {note.note}
                    <p className={styles.noteMeta}>@{note.reporterUsername} · {formatRelativeTimeFromNow(note.reportedAt)}</p>
                  </li>
                ))}
              </ul>
            ) : <p className={styles.muted}>Reporters left no notes.</p>}
          </div>
          <div className={styles.section}>
            <SectionHeading>Intelligence service signals</SectionHeading>
            <ClassifierScoreBars scores={report.classifierScores} />
          </div>
          <div className={styles.section}>
            <SectionHeading>Earlier actions on this author</SectionHeading>
            {report.priorActionsOnAuthor.length === 0 ? <p className={styles.muted}>None. First time this author is actioned.</p> : (
              <ul className={styles.plainList}>
                {report.priorActionsOnAuthor.map((priorAction) => (
                  <li key={`${priorAction.action}-${priorAction.occurredAt}`} className={styles.noteItem}>
                    <strong>{humanizeConstantName(priorAction.action)}</strong> — {priorAction.reason}
                    <p className={styles.noteMeta}>{formatDateTime(priorAction.occurredAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className={styles.section}>
            <SectionHeading>History</SectionHeading>
            <AuditHistoryList entries={report.history} />
          </div>
          <ReportActionDialog report={report} action={pendingAction} onClose={() => setPendingAction(null)} onCompleted={handleActionCompleted} />
        </>
      ) : null}
    </SidePanel>
  );
}
