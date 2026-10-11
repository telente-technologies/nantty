"use client";

import Link from "next/link";
import { useState } from "react";

import { AuditHistoryList } from "@/components/audit/auditHistoryList";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { ErrorBlock, LoadingBlock, NoticeBanner } from "@/components/ui/feedback";
import { SidePanel } from "@/components/ui/sidePanel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { KeyValueList, SectionHeading } from "@/components/ui/surfaces";
import { useToast } from "@/components/ui/toastProvider";
import { UserIdentity } from "@/components/ui/userIdentity";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { decideModerationAppeal, fetchModerationAppealDetail } from "@/services/trustApi.service";
import type { AppealDetail } from "@/types/moderation.type";
import { formatDateTime, formatRelativeTimeFromNow, humanizeConstantName } from "@/utils/formatting.util";

import { DueTimeLabel, ModeratedTargetPreviewCard } from "./moderatedTargetPreview";
import styles from "./trustShared.module.css";

type AppealOutcome = "UPHELD" | "OVERTURNED";

function describeOverturnConsequences(appeal: AppealDetail): string[] {
  const consequences = ["The content becomes visible again.", `@${appeal.appellant.username} is notified that the decision was reversed.`];
  if (appeal.decisionType === "SUSPENSION") consequences.push("The suspension is lifted immediately.");
  if (appeal.decisionType === "STRIKE" || appeal.decisionType === "SUSPENSION") consequences.push(`One strike is removed (${appeal.appellant.strikeCount} to ${Math.max(0, appeal.appellant.strikeCount - 1)}).`);
  return consequences;
}

export function AppealDetailPanel({ appealId, onClose, onAppealChanged }: { readonly appealId: string; readonly onClose: () => void; readonly onAppealChanged: () => void }) {
  const { data: appeal, errorMessage, error: queryError, isLoading, reload, replaceData } = useAdminQuery((signal) => fetchModerationAppealDetail(appealId, signal), appealId);
  const [pendingOutcome, setPendingOutcome] = useState<AppealOutcome | null>(null);
  const { showToast } = useToast();
  const decision = useAdminMutation((input: { outcome: AppealOutcome; reason: string }) => decideModerationAppeal(appealId, input.outcome, input.reason));

  async function confirmOutcome(reason: string) {
    if (!pendingOutcome) return;
    const updated = await decision.run({ outcome: pendingOutcome, reason });
    if (!updated) return;
    replaceData(() => updated);
    showToast(pendingOutcome === "OVERTURNED" ? "Decision overturned. The user has been notified." : "Original decision upheld. The user has been notified.");
    setPendingOutcome(null);
    onAppealChanged();
  }

  const isPending = appeal?.status === "PENDING";
  return (
    <SidePanel
      isOpen
      onClose={onClose}
      width="wide"
      title={appeal ? `Appeal: ${humanizeConstantName(appeal.decisionType)}` : "Appeal"}
      subtitle={appeal ? <>{appeal.id} · submitted {formatRelativeTimeFromNow(appeal.submittedAt)} · <DueTimeLabel dueAt={appeal.slaDueAt} isOpen={isPending} /></> : null}
      footer={isPending ? (
        <>
          <Button variant="secondary" onClick={() => setPendingOutcome("UPHELD")}>Uphold original decision</Button>
          <Button variant="primary" onClick={() => setPendingOutcome("OVERTURNED")}>Overturn decision</Button>
        </>
      ) : null}
    >
      {errorMessage ? <ErrorBlock error={queryError} message={errorMessage} onRetry={reload} /> : null}
      {isLoading && !appeal ? <LoadingBlock /> : null}
      {appeal ? (
        <>
          {appeal.decision ? (
            <NoticeBanner tone={appeal.decision.outcome === "OVERTURNED" ? "success" : "info"} title={`${humanizeConstantName(appeal.decision.outcome)} by ${appeal.decision.decidedByName}`}>
              {appeal.decision.reason} · {formatDateTime(appeal.decision.decidedAt)}
            </NoticeBanner>
          ) : null}
          <div className={styles.section}>
            <SectionHeading actions={<Link href={`/users/${appeal.appellant.id}`}>Open profile</Link>}>Appellant</SectionHeading>
            <UserIdentity user={appeal.appellant} size={36} />
            <KeyValueList columns={3} items={[
              { label: "Account", value: <StatusBadge status={appeal.appellant.status} /> },
              { label: "Strikes", value: appeal.appellant.strikeCount },
              { label: "Appeal", value: <StatusBadge status={appeal.status} /> },
            ]} />
          </div>
          <div className={styles.section}>
            <SectionHeading>Original decision</SectionHeading>
            <KeyValueList columns={2} items={[
              { label: "Action", value: humanizeConstantName(appeal.originalDecision.action) },
              { label: "Decided by", value: `${appeal.originalDecision.decidedByName} · ${formatDateTime(appeal.originalDecision.decidedAt)}` },
              { label: "Reason given", value: appeal.originalDecision.reason },
              { label: "From report", value: appeal.originalDecision.reportId ?? "Direct action" },
            ]} />
            <ModeratedTargetPreviewCard target={appeal.target} />
          </div>
          <div className={styles.section}>
            <SectionHeading>What the user says</SectionHeading>
            <p className={styles.statement}>{appeal.userStatement}</p>
            {appeal.evidenceNotes.length > 0 ? (
              <ul className={styles.plainList}>
                {appeal.evidenceNotes.map((note) => <li key={note} className={styles.noteItem}>{note}</li>)}
              </ul>
            ) : <p className={styles.muted}>No evidence attached.</p>}
          </div>
          <div className={styles.section}>
            <SectionHeading>History</SectionHeading>
            <AuditHistoryList entries={appeal.history} />
          </div>
          <ConfirmActionDialog intent="dispute"
            isOpen={pendingOutcome !== null}
            title={pendingOutcome === "OVERTURNED" ? "Overturn this decision" : "Uphold the original decision"}
            description="A different admin from the one who made the original decision must decide appeals."
            consequences={pendingOutcome === "OVERTURNED" ? describeOverturnConsequences(appeal) : ["The original action stays in place.", "The user is told the appeal was reviewed and can't appeal this decision again."]}
            confirmLabel={pendingOutcome === "OVERTURNED" ? "Overturn decision" : "Uphold decision"}
            reasonLabel="Explanation sent to the user (and saved to the audit log)"
            isBusy={decision.isRunning}
            errorMessage={decision.errorMessage}
            onConfirm={confirmOutcome}
            onClose={() => { decision.clearError(); setPendingOutcome(null); }}
          />
        </>
      ) : null}
    </SidePanel>
  );
}
