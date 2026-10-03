"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { NoticeBanner } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Card, KeyValueList } from "@/components/ui/surfaces";
import { useToast } from "@/components/ui/toastProvider";
import { UserIdentity } from "@/components/ui/userIdentity";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { decideCopyrightClaim, type CopyrightClaimDecision } from "@/services/trustApi.service";
import type { CopyrightClaimDetail } from "@/types/copyright.type";
import { formatDateTime, humanizeConstantName } from "@/utils/formatting.util";

import styles from "./copyrightClaim.module.css";

function describeDecisionConsequences(claim: CopyrightClaimDetail, decision: CopyrightClaimDecision): string[] {
  const nextStrikeCount = claim.infringerStrikeCount + 1;
  if (decision === "uphold") {
    const consequences = ["The target is taken down everywhere, including clips that reuse it.", `@${claim.infringer.username} gets a copyright strike (${claim.infringerStrikeCount} to ${nextStrikeCount}) and can file a counter-notice.`];
    if (nextStrikeCount >= claim.repeatInfringerThreshold) consequences.push(`This makes @${claim.infringer.username} a repeat infringer (${claim.repeatInfringerThreshold}+ strikes). Policy is to ban the account — do that from their profile.`);
    return consequences;
  }
  if (decision === "reject") return ["The target stays up and any limit is lifted.", "The claimant is told why the claim was rejected."];
  return ["The claimant is asked for the details you describe below.", "The claim stays open; the target keeps its current flag."];
}

const decisionLabels: Record<CopyrightClaimDecision, string> = { uphold: "Uphold claim", reject: "Reject claim", "request-info": "Ask claimant for more info" };

export function CopyrightDecisionCard({ claim, onClaimUpdated }: { readonly claim: CopyrightClaimDetail; readonly onClaimUpdated: (updated: CopyrightClaimDetail) => void }) {
  const [pendingDecision, setPendingDecision] = useState<CopyrightClaimDecision | null>(null);
  const { showToast } = useToast();
  const mutation = useAdminMutation((input: { decision: CopyrightClaimDecision; reason: string }) => decideCopyrightClaim(claim.id, input.decision, input.reason));
  const isDecidable = claim.status === "PENDING" || claim.status === "NEEDS_INFO";
  const isRepeatInfringer = claim.infringerStrikeCount >= claim.repeatInfringerThreshold;

  async function confirmDecision(reason: string) {
    if (!pendingDecision) return;
    const updated = await mutation.run({ decision: pendingDecision, reason });
    if (!updated) return;
    onClaimUpdated(updated);
    showToast(pendingDecision === "uphold" ? `Claim upheld. @${updated.infringer.username} now has ${updated.infringerStrikeCount} strike${updated.infringerStrikeCount === 1 ? "" : "s"}.` : pendingDecision === "reject" ? "Claim rejected." : "Request sent to the claimant.");
    setPendingDecision(null);
  }

  return (
    <>
      <Card title="Uploader" actions={<Link href={`/users/${claim.infringer.id}`}>Open profile</Link>}>
        <div className={styles.decisionActions}>
          <UserIdentity user={claim.infringer} size={36} />
          <KeyValueList columns={2} items={[
            { label: "Account", value: <StatusBadge status={claim.infringer.status} /> },
            { label: "Strikes", value: <span className={styles.strikeMeter} aria-label={`${claim.infringerStrikeCount} of ${claim.repeatInfringerThreshold} strikes`}>{Array.from({ length: claim.repeatInfringerThreshold }, (_, index) => <span key={index} className={index < claim.infringerStrikeCount ? `${styles.strikePip} ${styles.strikePipFilled}` : styles.strikePip} />)}</span> },
          ]} />
          {isRepeatInfringer ? <NoticeBanner tone="danger" title="Repeat infringer">@{claim.infringer.username} has {claim.infringerStrikeCount} strikes. Policy recommends banning this account.</NoticeBanner> : null}
        </div>
      </Card>
      <Card title="Decision">
        <div className={styles.decisionActions}>
          {claim.decision ? <NoticeBanner tone={claim.decision.outcome === "REJECTED" ? "info" : "caution"} title={`${humanizeConstantName(claim.decision.outcome)} by ${claim.decision.decidedByName}`}>{claim.decision.reason} · {formatDateTime(claim.decision.decidedAt)}</NoticeBanner> : null}
          {isDecidable ? (
            <>
              {claim.infringerStrikeCount + 1 >= claim.repeatInfringerThreshold ? <NoticeBanner tone="caution">Upholding gives @{claim.infringer.username} strike {claim.infringerStrikeCount + 1} of {claim.repeatInfringerThreshold}.</NoticeBanner> : null}
              <Button variant="danger" onClick={() => setPendingDecision("uphold")}>Uphold claim and take down</Button>
              <Button variant="secondary" onClick={() => setPendingDecision("reject")}>Reject claim</Button>
              {claim.status === "PENDING" ? <Button variant="ghost" onClick={() => setPendingDecision("request-info")}>Ask claimant for more info</Button> : null}
            </>
          ) : !claim.decision ? <p className={styles.muted}>No decision needed right now.</p> : null}
        </div>
      </Card>
      <ConfirmActionDialog
        isOpen={pendingDecision !== null}
        title={pendingDecision ? decisionLabels[pendingDecision] : ""}
        consequences={pendingDecision ? describeDecisionConsequences(claim, pendingDecision) : []}
        confirmLabel={pendingDecision ? decisionLabels[pendingDecision] : ""}
        tone={pendingDecision === "uphold" ? "danger" : "default"}
        reasonLabel={pendingDecision === "request-info" ? "What the claimant must send (saved to the audit log)" : "Reason (shared with both parties and saved to the audit log)"}
        isBusy={mutation.isRunning}
        errorMessage={mutation.errorMessage}
        onConfirm={confirmDecision}
        onClose={() => { mutation.clearError(); setPendingDecision(null); }}
      />
    </>
  );
}
