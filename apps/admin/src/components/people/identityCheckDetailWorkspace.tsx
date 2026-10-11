"use client";

import { useState } from "react";

import { useAdminPermissions } from "@/components/session/adminSessionProvider";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { ErrorBlock, LoadingBlock } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/pageHeader";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Card, KeyValueList, TwoColumnLayout } from "@/components/ui/surfaces";
import { useToast } from "@/components/ui/toastProvider";
import { identityCheckTone, identityReasonCopy, refundStatusCopy } from "@/constants/identityVerification.constant";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { decideIdentityCase, fetchIdentityCaseDetail } from "@/services/identityVerificationApi.service";
import type { IdentityCaseDecision, IdentityCaseDetail } from "@/types/identityVerification.type";
import { formatDateTime, humanizeConstantName } from "@/utils/formatting.util";

import styles from "./peopleWorkspace.module.css";

const openStatuses = new Set(["awaiting_consent", "awaiting_capture", "processing", "under_review"]);
const percent = (value: number) => `${Math.round(value * 100)}%`;

function describeDecision(detail: IdentityCaseDetail, decision: IdentityCaseDecision): string[] {
  const item = detail.case;
  if (decision === "approve") {
    return [`@${detail.profile.handle} gets the ${item.color} checkmark immediately and is notified.`, ...(item.status !== "under_review" ? ["This is a manual pass: the Smile ID result is not complete yet."] : [])];
  }
  return describeRejectionConsequences(item);
}

function describeRejectionConsequences(item: IdentityCaseDetail["case"]): string[] {
  const reapply = "The user is told the verification was not approved, with your reason, and can try again in 30 days.";
  if (item.refundScope === "checkmark_share") {
    const share = item.refundMethod === "card" ? "Only the checkmark's share of this period's payment is refunded to their card (the standalone checkmark price for their region, capped at what they paid)." : "Only the checkmark's share is refunded: Google Play if it supports partial refunds, otherwise flagged for a manual store refund.";
    return [reapply, "Their plan stays active with all its features; only the checkmark is withheld.", share];
  }
  const refund = item.refundMethod === "apple_request" ? "The subscription is cancelled and the user is told to request the refund from Apple." : "The payment is refunded automatically in full.";
  return [reapply, refund];
}

export function IdentityCheckDetailWorkspace({ caseId }: { readonly caseId: string }) {
  const { can } = useAdminPermissions();
  const { showToast } = useToast();
  const [decision, setDecision] = useState<IdentityCaseDecision | null>(null);
  const { data: detail, errorMessage, isLoading, reload, replaceData } = useAdminQuery((signal) => fetchIdentityCaseDetail(caseId, signal), caseId);
  const mutation = useAdminMutation(({ choice, reason }: { choice: IdentityCaseDecision; reason: string }) => decideIdentityCase(caseId, choice, reason));

  if (errorMessage) return <ErrorBlock message={errorMessage} onRetry={reload} />;
  if (isLoading || !detail) return <LoadingBlock lines={8} />;
  const item = detail.case;
  const checks = [
    { label: "Selfie liveness", value: item.checks.liveness },
    { label: "Document valid", value: item.checks.document },
    { label: `Face match${item.checks.faceMatchConfidence > 0 ? ` (${percent(item.checks.faceMatchConfidence)})` : ""}`, value: item.checks.faceMatch },
    { label: "Government database", value: item.checks.databaseLookup },
  ];

  async function confirmDecision(reason: string) {
    if (!decision) return;
    const updated = await mutation.run({ choice: decision, reason });
    if (!updated || !detail) return;
    replaceData((current) => (current ? { ...current, case: updated } : current));
    showToast(decision === "approve" ? "Checkmark granted" : "Rejected; refund started");
    setDecision(null);
  }

  return (
    <>
      <PageHeader area="People · Identity checks" title={`${humanizeConstantName(item.color)} checkmark for @${detail.profile.handle}`} meta={<><StatusBadge status={item.status.toUpperCase()} label={humanizeConstantName(item.status)} /><span className="mono">{item.id}</span></>} />
      <TwoColumnLayout
        main={
          <>
            <Card title="Smile ID result">
              <ul className={styles.checkList}>
                {checks.map((check) => (
                  <li key={check.label} className={styles.check}>
                    <span><strong>{check.label}</strong></span>
                    <StatusBadge tone={identityCheckTone[check.value]} label={humanizeConstantName(check.value)} />
                  </li>
                ))}
              </ul>
              <KeyValueList columns={2} items={[
                { label: "Name match", value: percent(item.checks.nameMatchScore) },
                { label: "ID", value: `${humanizeConstantName(item.documentType || "unknown")} · ${item.documentCountry || "—"}` },
                { label: "Smile job", value: item.smileReference || "—", isMono: true },
                { label: "Result code", value: item.smileResultCode || "—", isMono: true },
              ]} />
              <p className={styles.faint}>Only results are stored. Selfies and ID images stay with Smile ID; open the job in the Smile ID portal if you need to see them.</p>
            </Card>
            <Card title="Why it was not approved automatically">
              {item.decisionReasons.length === 0 ? <p className={styles.faint}>No blocking reasons.</p> : <ul>{item.decisionReasons.map((reason) => <li key={reason}>{identityReasonCopy[reason] ?? humanizeConstantName(reason)}</li>)}</ul>}
              {item.fraudSignals.length > 0 ? <p className={styles.consequenceNote}>Fraud signals sent to Trust as an advisory case: {item.fraudSignals.map((signal) => identityReasonCopy[signal] ?? signal).join(", ")}.</p> : null}
            </Card>
          </>
        }
        aside={
          <>
            <Card title="Profile and health">
              <KeyValueList items={[
                { label: "Account name", value: detail.profile.accountName || "—" },
                { label: "Display name", value: detail.profile.displayName || "—" },
                { label: "Profile type", value: humanizeConstantName(detail.profile.profileType) },
                { label: "Joined", value: detail.profile.joinedAt || "—" },
                { label: "Real followers", value: String(detail.health.realFollowers) },
                { label: "Days since last strike", value: detail.health.daysSinceLastViolation >= 100000 ? "Never" : String(detail.health.daysSinceLastViolation) },
                { label: "Fraud / risk score", value: `${detail.health.fraudScore} / ${detail.health.riskScore}` },
                { label: "Trust score at check", value: `${item.trustScore}${item.eligibleAtPayment ? "" : " (paid before qualifying)"}` },
              ]} />
            </Card>
            <Card title="Payment">
              <KeyValueList items={[
                { label: "Plan", value: item.planCode },
                { label: "Paid through", value: humanizeConstantName(item.paymentChannel) },
                { label: "Refund", value: refundStatusCopy[item.refundStatus] ?? item.refundStatus },
              ]} />
            </Card>
            <Card title="Decision">
              {item.decidedAt ? <p className={styles.faint}>Decided {formatDateTime(item.decidedAt)} by {item.decidedByName}: “{item.decisionReason}”</p> : null}
              {openStatuses.has(item.status) && can("verification:review") ? (
                <div className={styles.actionBar}>
                  <Button variant="primary" iconName="shield24" onClick={() => { mutation.clearError(); setDecision("approve"); }}>Approve</Button>
                  <Button variant="quietDanger" iconName="shield24" onClick={() => { mutation.clearError(); setDecision("reject"); }}>Reject and refund</Button>
                </div>
              ) : null}
            </Card>
          </>
        }
      />
      {decision ? (
        <ConfirmActionDialog intent="verify"
          isOpen
          title={decision === "approve" ? `Approve @${detail.profile.handle}` : `Reject @${detail.profile.handle}`}
          consequences={describeDecision(detail, decision)}
          confirmLabel={decision === "approve" ? "Approve" : "Reject and refund"}
          tone={decision === "approve" ? "default" : "danger"}
          requiresStepUp
          isBusy={mutation.isRunning}
          errorMessage={mutation.errorMessage}
          onConfirm={confirmDecision}
          onClose={() => setDecision(null)}
        />
      ) : null}
    </>
  );
}
