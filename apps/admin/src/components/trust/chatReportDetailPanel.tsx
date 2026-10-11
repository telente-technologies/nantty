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
import { chatReportActions } from "@/constants/chatReportOptions.constant";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchChatReportDetail } from "@/services/chatReportsApi.service";
import type { ChatReportAction, ChatReportDetail } from "@/types/chatReport.type";
import { formatDateTime, formatRelativeTimeFromNow, humanizeConstantName } from "@/utils/formatting.util";

import { ChatEvidenceTranscript } from "./chatEvidenceTranscript";
import { ChatReportActionDialog, chatReportActionPresentations } from "./chatReportActionDialog";
import { ClassifierScoreBars, DueTimeLabel } from "./moderatedTargetPreview";
import evidenceStyles from "./chatEvidence.module.css";
import styles from "./trustShared.module.css";

export function ChatReportDetailPanel({ reportId, onClose, onReportChanged }: { readonly reportId: string | null; readonly onClose: () => void; readonly onReportChanged: () => void }) {
  const { data: report, errorMessage, error: queryError, isLoading, reload, replaceData } = useAdminQuery((signal) => fetchChatReportDetail(reportId ?? "", signal), reportId ?? "", reportId !== null);
  const [pendingAction, setPendingAction] = useState<ChatReportAction | null>(null);
  const { can } = useAdminPermissions();
  const { showToast } = useToast();
  const isOpenReport = report?.status === "OPEN" || report?.status === "IN_REVIEW";
  const availableActions = chatReportActions.filter((action) => {
    if (!can(chatReportActionPresentations[action].permission)) return false;
    if (action === "REMOVE_GROUP") return report?.targetType === "GROUP";
    return report?.reportedUser || action === "DISMISS" || action === "ESCALATE_LEGAL";
  });

  function handleActionCompleted(updated: ChatReportDetail, action: ChatReportAction) {
    replaceData(() => updated);
    setPendingAction(null);
    showToast(`${chatReportActionPresentations[action].confirmLabel}: done. Logged to the audit trail.`);
    onReportChanged();
  }

  return (
    <SidePanel
      isOpen={reportId !== null}
      onClose={onClose}
      width="wide"
      title={report ? `${humanizeConstantName(report.targetType)} report · ${humanizeConstantName(report.reason)}` : "Chat report"}
      subtitle={report ? <>{report.id} · reported {formatRelativeTimeFromNow(report.createdAt)} · <DueTimeLabel dueAt={report.slaDueAt} isOpen={isOpenReport} /></> : null}
      footer={
        report && isOpenReport
          ? availableActions.map((action) => (
              <Button key={action} size="small" variant={chatReportActionPresentations[action].isDestructive ? "quietDanger" : action === "DISMISS" ? "ghost" : "secondary"} iconName={chatReportActionPresentations[action].requiresStepUp ? "shield24" : undefined} onClick={() => setPendingAction(action)}>
                {chatReportActionPresentations[action].confirmLabel}
              </Button>
            ))
          : null
      }
    >
      {errorMessage ? <ErrorBlock error={queryError} message={errorMessage} onRetry={reload} /> : null}
      {isLoading && !report ? <LoadingBlock /> : null}
      {report ? (
        <>
          {report.reason === "CHILD_SAFETY" ? <NoticeBanner tone="danger" title="Urgent: child safety">Priority path. Preserve the evidence and follow the child-safety escalation procedure.</NoticeBanner> : null}
          {report.reason === "SELF_HARM" ? <NoticeBanner tone="caution" title="Self-harm">Check whether the reporter or the other person needs support resources.</NoticeBanner> : null}
          {report.decision ? (
            <NoticeBanner tone={report.status === "DISMISSED" ? "info" : "success"} title={`${humanizeConstantName(report.decision.chatAction)} by ${report.decision.decidedByName}`}>
              {report.decision.reason} · {formatDateTime(report.decision.decidedAt)}
              {report.reporterOutcome ? ` · Reporter told: ${report.reporterOutcome === "TOOK_ACTION" ? "We took action" : "No violation found"}` : " · Reporter not notified yet"}
            </NoticeBanner>
          ) : null}
          <div className={styles.section}>
            <SectionHeading>Reporter</SectionHeading>
            <UserIdentity user={report.reporter} size={36} />
            {report.reporterBlockedReportedUser ? <p className={styles.muted}>Also blocked the reported account.</p> : null}
            <p>{report.details || "No extra details."}</p>
          </div>
          <div className={styles.section}>
            <SectionHeading actions={report.reportedUser ? <Link href={`/users/${report.reportedUser.id}`}>Open profile</Link> : null}>{report.reportedUser ? "Reported user" : "Reported group"}</SectionHeading>
            {report.reportedUser ? (
              <>
                <UserIdentity user={report.reportedUser} size={36} />
                <KeyValueList columns={3} items={[
                  { label: "Account", value: <StatusBadge status={report.reportedUser.status} /> },
                  { label: "Strikes", value: report.reportedUser.strikeCount },
                  { label: "Risk", value: <StatusBadge status={report.reportedUser.riskLevel} /> },
                ]} />
              </>
            ) : <p>{report.conversationLabel}</p>}
          </div>
          <div className={styles.section}>
            <SectionHeading actions={<span className={evidenceStyles.legalTag}>LEGAL REVIEW</span>}>Submitted messages ({report.evidenceCount})</SectionHeading>
            {report.transcript.length > 0 ? (
              <>
                <ChatEvidenceTranscript messages={report.transcript} />
                <KeyValueList columns={2} items={[
                  { label: "Selection", value: report.evidenceSelection === "picked_messages" ? "Picked by reporter" : "Latest messages" },
                  { label: "Integrity", value: report.isEvidenceHashVerified ? "SHA-256 hash matches" : "No hash" },
                  { label: "Hash", value: <span className={evidenceStyles.hash}>{report.evidenceHash}</span> },
                  { label: "Retained until", value: report.evidenceRetainedUntil ? formatDateTime(report.evidenceRetainedUntil) : "Not stored" },
                ]} />
              </>
            ) : <p className={styles.muted}>The reporter didn't submit any messages. This is a profile report.</p>}
          </div>
          <div className={styles.section}>
            <SectionHeading>Intelligence service signals</SectionHeading>
            {report.spamScore ? (
              <>
                <ClassifierScoreBars scores={[{ label: "spam", score: report.spamScore.score }]} source={report.spamScore.source} />
                <ul className={styles.plainList}>{report.spamScore.signals.map((signal) => <li key={signal}>{signal}</li>)}</ul>
              </>
            ) : <p className={styles.muted}>No spam score for this account.</p>}
          </div>
          <div className={styles.section}>
            <SectionHeading>History</SectionHeading>
            <AuditHistoryList entries={report.history} />
          </div>
          <ChatReportActionDialog report={report} action={pendingAction} onClose={() => setPendingAction(null)} onCompleted={handleActionCompleted} />
        </>
      ) : null}
    </SidePanel>
  );
}
