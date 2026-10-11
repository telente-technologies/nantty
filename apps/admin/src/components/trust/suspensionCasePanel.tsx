"use client";

import Link from "next/link";
import { useState } from "react";

import { AuditHistoryList } from "@/components/audit/auditHistoryList";
import { Button } from "@/components/ui/button";
import { ErrorBlock, LoadingBlock, NoticeBanner } from "@/components/ui/feedback";
import { SidePanel } from "@/components/ui/sidePanel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { KeyValueList, SectionHeading } from "@/components/ui/surfaces";
import { useToast } from "@/components/ui/toastProvider";
import { UserIdentity } from "@/components/ui/userIdentity";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchSuspensionCaseDetail, type SuspensionCaseDecision } from "@/services/safetyApi.service";
import type { SuspensionCaseDetail } from "@/types/suspensions.type";
import { formatDateTime, formatRelativeTimeFromNow, humanizeConstantName } from "@/utils/formatting.util";

import { SuspensionActionDialog, suspensionDecisionLabels } from "./suspensionActionDialog";
import styles from "./trustShared.module.css";

const decisionOrder: readonly SuspensionCaseDecision[] = ["dismiss", "escalate", "approve"];

export function SuspensionCasePanel({ caseId, onClose, onChanged }: { readonly caseId: string; readonly onClose: () => void; readonly onChanged: () => void }) {
  const { data: suspensionCase, errorMessage, error: queryError, isLoading, reload, replaceData } = useAdminQuery((signal) => fetchSuspensionCaseDetail(caseId, signal), caseId);
  const [pendingDecision, setPendingDecision] = useState<SuspensionCaseDecision | null>(null);
  const { showToast } = useToast();
  const isOpen = suspensionCase?.status === "PENDING" || suspensionCase?.status === "ESCALATED";

  function handleCompleted(updated: SuspensionCaseDetail, decision: SuspensionCaseDecision) {
    replaceData(() => updated);
    setPendingDecision(null);
    showToast(`${suspensionDecisionLabels[decision]}: done. Logged to the audit trail.`);
    onChanged();
  }

  return (
    <SidePanel
      isOpen
      onClose={onClose}
      width="wide"
      title={suspensionCase ? `Suspension case · risk ${suspensionCase.riskScore}` : "Suspension case"}
      subtitle={suspensionCase ? `${suspensionCase.id} · opened ${formatRelativeTimeFromNow(suspensionCase.createdAt)}` : null}
      footer={suspensionCase && isOpen ? decisionOrder.map((decision) => (
        <Button key={decision} size="small" variant={decision === "approve" ? "quietDanger" : decision === "dismiss" ? "ghost" : "secondary"} iconName="shield24" onClick={() => setPendingDecision(decision)}>{suspensionDecisionLabels[decision]}</Button>
      )) : null}
    >
      {errorMessage ? <ErrorBlock error={queryError} message={errorMessage} onRetry={reload} /> : null}
      {isLoading && !suspensionCase ? <LoadingBlock /> : null}
      {suspensionCase ? (
        <>
          <NoticeBanner tone="info" title={suspensionCase.source === "PYTHON_SUGGESTION" ? `Suggested by the risk service (${suspensionCase.modelVersion})` : "Raised from user reports"}>
            The risk service only suggests. Nothing happens to this account until an admin approves it.
          </NoticeBanner>
          {suspensionCase.decision ? (
            <NoticeBanner tone={suspensionCase.decision.outcome === "SUSPENDED" ? "danger" : "success"} title={`${humanizeConstantName(suspensionCase.decision.outcome)} by ${suspensionCase.decision.decidedByName}`}>
              {suspensionCase.decision.reason} · {formatDateTime(suspensionCase.decision.decidedAt)}
            </NoticeBanner>
          ) : null}
          <div className={styles.section}>
            <SectionHeading actions={<Link href={`/users/${suspensionCase.user.id}`}>Open profile</Link>}>Account</SectionHeading>
            <UserIdentity user={suspensionCase.user} size={36} />
            <KeyValueList columns={3} items={[{ label: "Status", value: <StatusBadge status={suspensionCase.user.status} /> }, { label: "Strikes", value: suspensionCase.user.strikeCount }, { label: "Risk score", value: suspensionCase.riskScore }]} />
          </div>
          <div className={styles.section}>
            <SectionHeading>Signals</SectionHeading>
            <ul className={styles.scoreList}>
              {suspensionCase.signals.map((signal) => (
                <li key={signal.label}>
                  <div className={styles.scoreRow}>
                    <span className={styles.scoreLabel}>{signal.label}</span>
                    <span className={styles.scoreTrack}><span className={`${styles.scoreFill} ${signal.weight >= 40 ? styles.scoreFillHigh : styles.scoreFillMedium}`} style={{ display: "block", width: `${signal.weight}%` }} /></span>
                    <span className={styles.scoreValue}>{signal.weight}</span>
                  </div>
                  <p className={styles.noteMeta}>{signal.detail}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className={styles.section}>
            <SectionHeading>Evidence</SectionHeading>
            <ul className={styles.plainList}>
              {suspensionCase.evidence.map((link) => <li key={link.href + link.label}><Link href={link.href}>{link.label}</Link></li>)}
            </ul>
          </div>
          <div className={styles.section}>
            <SectionHeading>User reports ({suspensionCase.reports.length})</SectionHeading>
            {suspensionCase.reports.length === 0 ? <p className={styles.muted}>No user reports. This case comes from behaviour signals only.</p> : (
              <ul className={styles.plainList}>
                {suspensionCase.reports.map((report) => (
                  <li key={report.id} className={styles.noteItem}>
                    <strong>{humanizeConstantName(report.reason)}</strong> — {report.excerpt}
                    <p className={styles.noteMeta}>{report.id} · {formatRelativeTimeFromNow(report.reportedAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className={styles.section}>
            <SectionHeading>History</SectionHeading>
            <AuditHistoryList entries={suspensionCase.history} />
          </div>
          <SuspensionActionDialog suspensionCase={suspensionCase} decision={pendingDecision} onClose={() => setPendingDecision(null)} onCompleted={handleCompleted} />
        </>
      ) : null}
    </SidePanel>
  );
}
