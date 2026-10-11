"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useToast } from "@/components/ui/toastProvider";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { decideCounterNotice } from "@/services/trustApi.service";
import type { CopyrightClaimDetail, CounterNotice } from "@/types/copyright.type";
import { formatDateOnly, formatDateTime } from "@/utils/formatting.util";

import styles from "./copyrightClaim.module.css";

export function CounterNoticeList({ claim, onClaimUpdated }: { readonly claim: CopyrightClaimDetail; readonly onClaimUpdated: (updated: CopyrightClaimDetail) => void }) {
  const [pending, setPending] = useState<{ notice: CounterNotice; decision: "accept" | "reject" } | null>(null);
  const { showToast } = useToast();
  const mutation = useAdminMutation((input: { noticeId: string; decision: "accept" | "reject"; reason: string }) => decideCounterNotice(claim.id, input.noticeId, input.decision, input.reason));

  async function confirmDecision(reason: string) {
    if (!pending) return;
    const updated = await mutation.run({ noticeId: pending.notice.id, decision: pending.decision, reason });
    if (!updated) return;
    onClaimUpdated(updated);
    showToast(pending.decision === "accept" ? "Counter-notice accepted and forwarded to the claimant." : "Counter-notice rejected. The takedown stays.");
    setPending(null);
  }

  if (claim.counterNotices.length === 0) return <p className={styles.muted}>No counter-notice filed by the uploader.</p>;
  return (
    <>
      <ul className={styles.noticeList}>
        {claim.counterNotices.map((notice) => (
          <li key={notice.id} className={styles.noticeItem}>
            <div className={styles.noticeHeader}>
              <span className={styles.muted}>{notice.id} · filed {formatDateTime(notice.submittedAt)}</span>
              <StatusBadge status={notice.status} />
            </div>
            <p className={styles.statement}>{notice.statement}</p>
            <span className={styles.muted}>Restore window ends {formatDateOnly(notice.restoreEligibleAt)} (10 business days) unless the claimant shows court action.</span>
            {notice.status === "PENDING" && claim.status === "COUNTER_NOTICE" ? (
              <div className={styles.noticeActions}>
                <Button size="small" variant="primary" onClick={() => setPending({ notice, decision: "accept" })}>Accept counter-notice</Button>
                <Button size="small" variant="quietDanger" onClick={() => setPending({ notice, decision: "reject" })}>Reject counter-notice</Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      <ConfirmActionDialog intent="copyright"
        isOpen={pending !== null}
        title={pending?.decision === "accept" ? "Accept this counter-notice" : "Reject this counter-notice"}
        consequences={pending?.decision === "accept"
          ? ["The claimant receives the counter-notice and the uploader's contact details.", `The content is restored after ${pending ? formatDateOnly(pending.notice.restoreEligibleAt) : "the waiting period"} unless the claimant files court action.`]
          : ["The takedown and strike stay in place.", "The uploader is told why the counter-notice was not valid."]}
        confirmLabel={pending?.decision === "accept" ? "Accept counter-notice" : "Reject counter-notice"}
        tone={pending?.decision === "reject" ? "danger" : "default"}
        isBusy={mutation.isRunning}
        errorMessage={mutation.errorMessage}
        onConfirm={confirmDecision}
        onClose={() => { mutation.clearError(); setPending(null); }}
      />
    </>
  );
}
