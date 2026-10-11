"use client";

import { useState } from "react";

import { useAdminPermissions } from "@/components/session/adminSessionProvider";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { Card } from "@/components/ui/surfaces";
import { useToast } from "@/components/ui/toastProvider";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { applyVerificationTransition } from "@/services/peopleReviewsApi.service";
import type { VerificationApplicationDetail, VerificationTransition } from "@/types/verification.type";
import { formatDateTime } from "@/utils/formatting.util";

import styles from "./peopleWorkspace.module.css";

const transitionCopy: Record<VerificationTransition, { label: string; toast: string; variant: "primary" | "secondary" | "quietDanger" | "danger"; isDangerous: boolean; requiresStepUp: boolean }> = {
  approve: { label: "Approve", toast: "Verification approved", variant: "primary", isDangerous: false, requiresStepUp: false },
  reject: { label: "Reject", toast: "Verification rejected", variant: "quietDanger", isDangerous: true, requiresStepUp: false },
  reinstate: { label: "Reinstate", toast: "Verification reinstated", variant: "primary", isDangerous: false, requiresStepUp: false },
  suspend: { label: "Suspend", toast: "Verification suspended", variant: "quietDanger", isDangerous: true, requiresStepUp: true },
  revoke: { label: "Revoke", toast: "Verification revoked", variant: "danger", isDangerous: true, requiresStepUp: true },
};

function describeConsequences(application: VerificationApplicationDetail, transition: VerificationTransition): string[] {
  const badgeName = `${application.color.toLowerCase()} ${application.tier.toLowerCase()}`;
  if (transition === "approve" || transition === "reinstate") {
    return [
      application.badgeVisibleWhenVerified ? `@${application.user.username} shows the ${application.color.toLowerCase()} badge publicly.` : "Essential is verified internally but never shows a public badge.",
      ...(application.grantsDashboardAccess ? ["Gold unlocks Zudomart Dashboard access (dashboard.zudomart.com) for this business."] : []),
      ...(application.color === "BLACK" ? ["Black is granted only after the official agency confirmation. It is never sold."] : []),
    ];
  }
  if (transition === "reject") return ["The applicant is told the request was not approved, with your reason.", ...(application.subscription ? ["Any prepaid plan fee is refunded by billing."] : [])];
  if (transition === "suspend") return [`The ${badgeName} badge is hidden until reinstated.`, ...(application.grantsDashboardAccess ? ["Zudomart Dashboard access is paused."] : [])];
  return [`The ${badgeName} verification ends permanently. The user must apply again.`, ...(application.grantsDashboardAccess ? ["Zudomart Dashboard access is removed."] : [])];
}

export function VerificationDecisionPanel({ application, onUpdated }: { readonly application: VerificationApplicationDetail; readonly onUpdated: (updated: VerificationApplicationDetail) => void }) {
  const { can } = useAdminPermissions();
  const { showToast } = useToast();
  const [activeTransition, setActiveTransition] = useState<VerificationTransition | null>(null);
  const transitionMutation = useAdminMutation(({ transition, reason }: { transition: VerificationTransition; reason: string }) => applyVerificationTransition(application.id, transition, reason));
  const permittedTransitions = application.allowedTransitions.filter((transition) => (transition === "suspend" || transition === "revoke" ? can("verification:revoke") : can("verification:review")));

  async function confirmTransition(reason: string) {
    if (!activeTransition) return;
    const updated = await transitionMutation.run({ transition: activeTransition, reason });
    if (!updated) return;
    onUpdated(updated);
    showToast(transitionCopy[activeTransition].toast);
    setActiveTransition(null);
  }

  return (
    <Card title="Decision">
      <div className={styles.stack}>
        {application.grantsDashboardAccess ? <p className={styles.consequenceNote}>Gold verification grants Zudomart Dashboard access for the business.</p> : null}
        {application.tier === "ESSENTIAL" ? <p className={styles.consequenceNote}>Blue Essential never shows a public badge.</p> : null}
        {application.color === "BLACK" ? <p className={styles.consequenceNote}>Black is for government bodies only. It is never purchasable; approve only after the agency confirms from its official domain.</p> : null}
        {application.reviewedAt ? <p className={styles.faint}>Last decision {formatDateTime(application.reviewedAt)} by {application.reviewedByName}: “{application.decisionReason}”</p> : null}
        {permittedTransitions.length > 0 ? (
          <div className={styles.actionBar}>
            {permittedTransitions.map((transition) => (
              <Button key={transition} variant={transitionCopy[transition].variant} iconName={transitionCopy[transition].requiresStepUp ? "shield24" : undefined} onClick={() => { transitionMutation.clearError(); setActiveTransition(transition); }}>
                {transitionCopy[transition].label}
              </Button>
            ))}
          </div>
        ) : (
          <p className={styles.faint}>{application.allowedTransitions.length === 0 ? "No further changes are possible in this state." : "Your permissions don't allow changing this verification."}</p>
        )}
      </div>
      {activeTransition ? (
        <ConfirmActionDialog intent="verify"
          isOpen
          title={`${transitionCopy[activeTransition].label} ${application.color.toLowerCase()} ${application.tier.toLowerCase()} for @${application.user.username}`}
          consequences={describeConsequences(application, activeTransition)}
          confirmLabel={transitionCopy[activeTransition].label}
          tone={transitionCopy[activeTransition].isDangerous ? "danger" : "default"}
          requiresStepUp={transitionCopy[activeTransition].requiresStepUp}
          isBusy={transitionMutation.isRunning}
          errorMessage={transitionMutation.errorMessage}
          onConfirm={confirmTransition}
          onClose={() => setActiveTransition(null)}
        />
      ) : null}
    </Card>
  );
}
