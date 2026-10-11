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
import { decideProgramApplication, fetchProgramApplicationDetail } from "@/services/peopleReviewsApi.service";
import type { ApplicationKind } from "@/types/applications.type";
import { formatDateTime, formatMoneyForDisplay } from "@/utils/formatting.util";

import styles from "./peopleWorkspace.module.css";
import { ZudoIcon } from "@/components/ui/zudoIcon";

interface ProgramApplicationPanelProps {
  readonly kind: ApplicationKind;
  readonly applicationId: string;
  readonly onClose: () => void;
  readonly onDecided: () => void;
}

export function ProgramApplicationPanel({ kind, applicationId, onClose, onDecided }: ProgramApplicationPanelProps) {
  const { showToast } = useToast();
  const [decision, setDecision] = useState<"approve" | "reject" | null>(null);
  const { data: application, errorMessage, isLoading, reload, replaceData } = useAdminQuery((signal) => fetchProgramApplicationDetail(kind, applicationId, signal), `${kind}:${applicationId}`);
  const decisionMutation = useAdminMutation(({ choice, reason }: { choice: "approve" | "reject"; reason: string }) => decideProgramApplication(kind, applicationId, choice, reason));
  const programName = kind === "sellers" ? "selling" : "the Creator Program";

  async function confirmDecision(reason: string) {
    if (!decision) return;
    const updated = await decisionMutation.run({ choice: decision, reason });
    if (!updated) return;
    replaceData(() => updated);
    setDecision(null);
    showToast(decision === "approve" ? "Application approved" : "Application rejected");
    onDecided();
  }

  return (
    <SidePanel
      isOpen
      title={application ? application.storeName ?? application.user.displayName : "Application"}
      subtitle={application ? <StatusBadge status={application.status} /> : null}
      onClose={onClose}
      footer={
        application?.status === "PENDING" ? (
          <>
            <Button variant="primary" onClick={() => { decisionMutation.clearError(); setDecision("approve"); }}>Approve</Button>
            <Button variant="quietDanger" onClick={() => { decisionMutation.clearError(); setDecision("reject"); }}>Reject</Button>
          </>
        ) : null
      }
    >
      {errorMessage ? <ErrorBlock message={errorMessage} onRetry={reload} /> : null}
      {isLoading && !application ? <LoadingBlock /> : null}
      {application ? (
        <>
          <div className={styles.row}>
            <UserIdentity user={application.user} size={36} />
            <Link href={`/users/${application.user.id}`}>Open user</Link>
          </div>
          {!application.isEligible && application.status === "PENDING" ? <NoticeBanner tone="caution">Some eligibility rules are not met. You can still approve with a reason.</NoticeBanner> : null}
          <SectionHeading>Eligibility snapshot</SectionHeading>
          <ul className={styles.checkList}>
            {application.eligibility.map((check) => (
              <li key={check.key} className={styles.check}>
                <span className={check.isMet ? styles.checkPass : styles.checkFail} aria-label={check.isMet ? "Met" : "Not met"}><ZudoIcon name={check.isMet ? "check16" : "cancel20"} size={14} /></span>
                <span>
                  <strong>{check.label}</strong>
                  <br />
                  <span className={styles.checkDetail}>Required {check.required}</span>
                </span>
                <span className="mono">{check.actual}</span>
              </li>
            ))}
          </ul>
          <SectionHeading>Application</SectionHeading>
          <KeyValueList
            items={[
              { label: "Pitch", value: application.pitch },
              ...(kind === "sellers" ? [{ label: "Categories", value: application.categories.join(", ") }, { label: "Expected monthly sales", value: formatMoneyForDisplay(application.expectedMonthlySales), isMono: true }] : [{ label: "Content niche", value: application.contentNiche ?? "—" }]),
              { label: "Submitted", value: formatDateTime(application.submittedAt) },
              ...(application.reviewedAt ? [{ label: "Decision", value: `${formatDateTime(application.reviewedAt)} by ${application.reviewedByName}: “${application.decisionReason}”` }] : []),
            ]}
          />
          <SectionHeading>History</SectionHeading>
          <AuditHistoryList entries={application.history} emptyMessage="No decisions yet." />
          <ConfirmActionDialog intent="verify"
            isOpen={decision !== null}
            title={decision === "approve" ? `Approve @${application.user.username} for ${programName}` : `Reject @${application.user.username}`}
            consequences={decision === "approve" ? (kind === "sellers" ? ["They can open a store and list products.", "Payouts still require a verified bank account."] : ["They can go live, receive gifts and earn ad revenue share."]) : ["They are told the application was not approved, with your reason.", "They can apply again after 30 days."]}
            confirmLabel={decision === "approve" ? "Approve" : "Reject"}
            tone={decision === "reject" ? "danger" : "default"}
            isBusy={decisionMutation.isRunning}
            errorMessage={decisionMutation.errorMessage}
            onConfirm={confirmDecision}
            onClose={() => setDecision(null)}
          />
        </>
      ) : null}
    </SidePanel>
  );
}
