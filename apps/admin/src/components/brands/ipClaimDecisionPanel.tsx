"use client";

import { useState } from "react";

import { useAdminPermissions } from "@/components/session/adminSessionProvider";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { NoticeBanner } from "@/components/ui/feedback";
import { CheckboxField } from "@/components/ui/formFields";
import { Card } from "@/components/ui/surfaces";
import { useToast } from "@/components/ui/toastProvider";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { decideIpClaim } from "@/services/brandsApi.service";
import type { IpClaimDecisionAction, IpClaimDetail } from "@/types/ipClaims.type";
import { formatDateTime, humanizeConstantName } from "@/utils/formatting.util";

import styles from "./brands.module.css";

const repeatInfringerStrikeThreshold = 3;

const decisionCopy: Record<IpClaimDecisionAction, { buttonLabel: string; title: string; confirmLabel: string; tone: "default" | "danger" }> = {
  uphold: { buttonLabel: "Uphold claim", title: "Uphold this claim", confirmLabel: "Uphold and delist", tone: "danger" },
  reject: { buttonLabel: "Reject claim", title: "Reject this claim", confirmLabel: "Reject claim", tone: "default" },
  "request-info": { buttonLabel: "Request more info", title: "Ask the claimant for more information", confirmLabel: "Send request", tone: "default" },
};

export function IpClaimDecisionPanel({ claim, onDecided }: { readonly claim: IpClaimDetail; readonly onDecided: (updated: IpClaimDetail) => void }) {
  const { can } = useAdminPermissions();
  const { showToast } = useToast();
  const [pendingAction, setPendingAction] = useState<IpClaimDecisionAction | null>(null);
  const [shouldAddStrike, setShouldAddStrike] = useState(true);
  const decision = useAdminMutation((input: { action: IpClaimDecisionAction; reason: string }) => decideIpClaim(claim.id, input.action, { reason: input.reason, addStrike: input.action === "uphold" ? shouldAddStrike : undefined }));
  const strikesAfterUphold = claim.priorStrikeCount + (shouldAddStrike ? 1 : 0);

  async function confirmDecision(reason: string) {
    if (!pendingAction) return;
    const result = await decision.run({ action: pendingAction, reason });
    if (!result) return;
    showToast(result.isRepeatInfringer && pendingAction === "uphold" ? `Claim upheld. @${claim.accusedSeller.username} now has ${result.sellerStrikeCount} strikes — consider suspending the account.` : `${decisionCopy[pendingAction].confirmLabel}: done.`);
    setPendingAction(null);
    onDecided(result.claim);
  }

  const upholdConsequences = [`Listing "${claim.listing.title}" is delisted immediately.`, shouldAddStrike ? `@${claim.accusedSeller.username} gets a strike (${claim.priorStrikeCount} to ${strikesAfterUphold}).` : "No strike is added.", "The claimant and the seller are notified with your reason."];
  return (
    <Card title="Decision">
      <div className={styles.layoutStack}>
        {claim.decision ? (
          <NoticeBanner tone={claim.decision.outcome === "UPHELD" ? "danger" : "info"} title={`${humanizeConstantName(claim.decision.outcome)} by ${claim.decision.decidedByName} · ${formatDateTime(claim.decision.decidedAt)}`}>
            {claim.decision.reason}
            {claim.decision.strikeAdded ? " A strike was added." : ""}
          </NoticeBanner>
        ) : null}
        {claim.priorStrikeCount >= repeatInfringerStrikeThreshold - 1 && claim.allowedActions.includes("uphold") ? (
          <NoticeBanner tone="caution" title="Repeat offender">
            @{claim.accusedSeller.username} already has {claim.priorStrikeCount} strikes. Upholding with a strike reaches {repeatInfringerStrikeThreshold}; plan a suspension from the user's page.
          </NoticeBanner>
        ) : null}
        {can("ip-claims:review") && claim.allowedActions.length > 0 ? (
          <div className={styles.actionRow}>
            {claim.allowedActions.map((action) => (
              <Button key={action} variant={action === "uphold" ? "danger" : "secondary"} iconName={action === "uphold" ? "shield24" : undefined} onClick={() => setPendingAction(action)}>
                {decisionCopy[action].buttonLabel}
              </Button>
            ))}
          </div>
        ) : (
          <p className={styles.muted}>No further decisions are possible on a {humanizeConstantName(claim.status).toLowerCase()} claim.</p>
        )}
      </div>
      {pendingAction ? (
        <ConfirmActionDialog
          isOpen
          title={decisionCopy[pendingAction].title}
          confirmLabel={decisionCopy[pendingAction].confirmLabel}
          tone={decisionCopy[pendingAction].tone}
          consequences={pendingAction === "uphold" ? upholdConsequences : undefined}
          requiresStepUp={pendingAction === "uphold"}
          isBusy={decision.isRunning}
          errorMessage={decision.errorMessage}
          onConfirm={confirmDecision}
          onClose={() => {
            decision.clearError();
            setPendingAction(null);
          }}
        >
          {pendingAction === "uphold" ? <CheckboxField label="Add a strike to the seller" description="Leave on for counterfeit goods. Turn off for a first-time title mistake that the seller corrected." checked={shouldAddStrike} onChange={(event) => setShouldAddStrike(event.target.checked)} /> : null}
        </ConfirmActionDialog>
      ) : null}
    </Card>
  );
}
