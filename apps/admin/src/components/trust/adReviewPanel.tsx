"use client";

import Link from "next/link";
import { useState } from "react";

import { AuditHistoryList } from "@/components/audit/auditHistoryList";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { ErrorBlock, LoadingBlock, NoticeBanner } from "@/components/ui/feedback";
import { CheckboxField, SelectField } from "@/components/ui/formFields";
import { SidePanel } from "@/components/ui/sidePanel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { KeyValueList, SectionHeading } from "@/components/ui/surfaces";
import { useToast } from "@/components/ui/toastProvider";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { approveAdAfterReview, fetchAdForReviewDetail, rejectAdForPolicy, resolveAdAppeal } from "@/services/adsReviewApi.service";
import type { AdPolicyCategory } from "@/types/adsReview.type";
import { formatDateOnly, formatDateTime, formatMoneyForDisplay, formatRelativeTimeFromNow, humanizeConstantName } from "@/utils/formatting.util";

import styles from "./adsReview.module.css";

export function AdReviewPanel({ adId, policies, onClose, onAdChanged }: { readonly adId: string; readonly policies: readonly AdPolicyCategory[]; readonly onClose: () => void; readonly onAdChanged: () => void }) {
  const { data: ad, errorMessage, error: queryError, isLoading, reload, replaceData } = useAdminQuery((signal) => fetchAdForReviewDetail(adId, signal), adId);
  const [pendingDecision, setPendingDecision] = useState<"approve" | "reject" | "uphold" | "overturn" | null>(null);
  const [policyCategoryId, setPolicyCategoryId] = useState("");
  const [isCriticalOverrideConfirmed, setIsCriticalOverrideConfirmed] = useState(false);
  const { showToast } = useToast();
  const mutation = useAdminMutation((input: { decision: "approve" | "reject" | "uphold" | "overturn"; reason: string }) => {
    if (input.decision === "approve") return approveAdAfterReview(adId, input.reason, isCriticalOverrideConfirmed);
    if (input.decision === "reject") return rejectAdForPolicy(adId, policyCategoryId, input.reason);
    return resolveAdAppeal(adId, input.decision, input.reason);
  });
  const activePolicies = policies.filter((policy) => policy.isActive);
  const hasCriticalFlag = ad?.autoCheckFlags.some((flag) => flag.severity === "CRITICAL") ?? false;

  function openRejection() {
    setPolicyCategoryId(ad?.autoCheckFlags[0]?.policyCategoryId ?? "");
    setPendingDecision("reject");
  }

  async function confirmDecision(reason: string) {
    if (!pendingDecision) return;
    const updated = await mutation.run({ decision: pendingDecision, reason });
    if (!updated) return;
    replaceData((current) => (current ? { ...current, ...updated } : updated));
    const messages = {
      approve: "Ad approved. It can start delivering.",
      reject: "Ad rejected. The advertiser was told which policy it breaks.",
      overturn: "Appeal overturned. Ad is now approved.",
      uphold: "Appeal upheld. Rejection stands.",
    } as const;
    showToast(messages[pendingDecision]);
    setPendingDecision(null);
    onAdChanged();
  }

  return (
    <SidePanel
      isOpen
      onClose={onClose}
      width="wide"
      title={ad ? ad.campaignName : "Ad"}
      subtitle={ad ? <>{ad.id} · {ad.advertiser.name} · submitted {formatRelativeTimeFromNow(ad.submittedAt)}</> : null}
      footer={ad?.status === "PENDING" ? (
        <>
          <Button variant="quietDanger" onClick={openRejection}>Reject ad</Button>
          <Button variant="primary" onClick={() => setPendingDecision("approve")}>Approve ad</Button>
        </>
      ) : ad?.status === "REJECTED" ? (
        <>
          <Button variant="quietDanger" onClick={() => setPendingDecision("uphold")}>Uphold rejection</Button>
          <Button variant="primary" onClick={() => setPendingDecision("overturn")}>Overturn &amp; approve</Button>
        </>
      ) : null}
    >
      {errorMessage ? <ErrorBlock error={queryError} message={errorMessage} onRetry={reload} /> : null}
      {isLoading && !ad ? <LoadingBlock /> : null}
      {ad ? (
        <>
          {ad.decision ? <NoticeBanner tone={ad.status === "APPROVED" ? "success" : "danger"} title={`${humanizeConstantName(ad.status)} by ${ad.decision.decidedByName}`}>{ad.decision.reason} · {formatDateTime(ad.decision.decidedAt)}</NoticeBanner> : null}
          {ad.advertiser.status === "SUSPENDED" ? <NoticeBanner tone="danger">This advertiser is suspended. Reinstate the account before approving its ads.</NoticeBanner> : null}
          <div className={styles.creative}>
            <img src={ad.creative.imageUrl} alt={`Creative for ${ad.campaignName}`} className={styles.creativeImage} referrerPolicy="no-referrer" />
            <div className={styles.creativeCopy}>
              <StatusBadge label={`${humanizeConstantName(ad.creative.format)}${ad.isBoostedPost ? " · boosted post" : ""}`} tone="info" hasDot={false} />
              <p className={styles.headline}>{ad.creative.headline}</p>
              <p>{ad.creative.primaryText}</p>
              <span className={styles.callToAction}>{ad.creative.callToAction}</span>
              <span className={styles.landingUrl}>{ad.creative.landingUrl}</span>
            </div>
          </div>
          <div className={styles.section}>
            <SectionHeading>Policy auto-check</SectionHeading>
            {ad.autoCheckFlags.length === 0 ? <p className={styles.muted}>No automatic flags.</p> : (
              <ul className={styles.flagList}>
                {ad.autoCheckFlags.map((flag) => (
                  <li key={`${flag.policyCategoryId}-${flag.detail}`} className={flag.severity === "CRITICAL" ? `${styles.flagItem} ${styles.flagCritical}` : styles.flagItem}>
                    <strong>{flag.label} · {humanizeConstantName(flag.severity)}</strong>
                    <span>{flag.detail}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className={styles.section}>
            <SectionHeading actions={<Link href="/ads/advertisers">Advertisers</Link>}>Delivery</SectionHeading>
            <KeyValueList columns={2} items={[
              { label: "Daily budget", value: formatMoneyForDisplay(ad.dailyBudget) },
              { label: "Total budget", value: ad.totalBudget ? formatMoneyForDisplay(ad.totalBudget) : "No cap" },
              { label: "Schedule", value: `${formatDateOnly(ad.schedule.startsAt)} to ${ad.schedule.endsAt ? formatDateOnly(ad.schedule.endsAt) : "ongoing"}` },
              { label: "Countries", value: ad.targeting.countries.join(", ") },
              { label: "Ages", value: ad.targeting.ageRange },
              { label: "Placements", value: ad.targeting.placements.join(", ") },
              { label: "Interests", value: ad.targeting.interests.join(", ") },
            ]} />
          </div>
          <div className={styles.section}>
            <SectionHeading>History</SectionHeading>
            <AuditHistoryList entries={ad.history} />
          </div>
          <ConfirmActionDialog intent="ads"
            isOpen={pendingDecision !== null}
            title={
              pendingDecision === "approve"
                ? "Approve this ad"
                : pendingDecision === "reject"
                  ? "Reject this ad"
                  : pendingDecision === "overturn"
                    ? "Overturn rejection on appeal"
                    : "Uphold rejection on appeal"
            }
            consequences={
              pendingDecision === "approve" || pendingDecision === "overturn"
                ? ["The ad enters the auction at its scheduled start.", "The advertiser is notified."]
                : ["The ad never delivers.", "The advertiser sees the policy and your reason."]
            }
            confirmLabel={
              pendingDecision === "approve"
                ? "Approve ad"
                : pendingDecision === "reject"
                  ? "Reject ad"
                  : pendingDecision === "overturn"
                    ? "Overturn & approve"
                    : "Uphold rejection"
            }
            tone={pendingDecision === "reject" || pendingDecision === "uphold" ? "danger" : "default"}
            requiresReason={pendingDecision === "reject" || pendingDecision === "uphold" || pendingDecision === "overturn"}
            reasonLabel="Reason or resolution note shown to the advertiser (saved to the audit log)"
            isConfirmDisabled={(pendingDecision === "reject" && !policyCategoryId) || (pendingDecision === "approve" && hasCriticalFlag && !isCriticalOverrideConfirmed)}
            isBusy={mutation.isRunning}
            errorMessage={mutation.errorMessage}
            onConfirm={confirmDecision}
            onClose={() => { mutation.clearError(); setPendingDecision(null); }}
          >
            {pendingDecision === "reject" ? <SelectField label="Policy broken" value={policyCategoryId} onChange={(event) => setPolicyCategoryId(event.target.value)} options={[{ value: "", label: "Choose a policy" }, ...activePolicies.map((policy) => ({ value: policy.id, label: `${policy.name} (${humanizeConstantName(policy.severity)})` }))]} /> : null}
            {pendingDecision === "approve" && hasCriticalFlag ? <CheckboxField label="Override the critical auto-check flag" description="I checked the creative and landing page myself and the flag is a false positive." checked={isCriticalOverrideConfirmed} onChange={(event) => setIsCriticalOverrideConfirmed(event.target.checked)} /> : null}
          </ConfirmActionDialog>
        </>
      ) : null}
    </SidePanel>
  );
}
