"use client";

import { useState } from "react";

import { AffiliateCreatorIdentity } from "@/components/affiliates/affiliateCreatorIdentity";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorCallout, LoadingBlock } from "@/components/ui/feedback";
import { TextAreaField } from "@/components/ui/formFields";
import { ModalDialog } from "@/components/ui/modalDialog";
import { SegmentedControl } from "@/components/ui/navigationTabs";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useToast } from "@/components/ui/toastProvider";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { AffiliateRequest, AffiliateRequestStatus } from "@/types/affiliate.type";
import type { CursorPage } from "@/types/pagination.type";
import { formatRelativeTimeFromNow } from "@/utils/dateFormatting.util";

import styles from "./affiliateViews.module.css";

const maximumDeclineReasonLength = 300;
const statusOptions: { value: AffiliateRequestStatus; label: string }[] = [
  { value: "pending", label: "Waiting" },
  { value: "approved", label: "Approved" },
  { value: "declined", label: "Declined" },
];

export function AffiliateRequestsView() {
  const [statusFilter, setStatusFilter] = useState<AffiliateRequestStatus>("pending");
  const requestsQuery = useSellerQuery<CursorPage<AffiliateRequest>>("/seller/affiliates/requests", { status: statusFilter, limit: 50 });
  const { showToast } = useToast();
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);
  const [requestBeingDeclined, setRequestBeingDeclined] = useState<AffiliateRequest | null>(null);
  const [declineReason, setDeclineReason] = useState("");

  async function answerCreatorRequest(affiliateRequest: AffiliateRequest, decision: "approve" | "decline", reason: string | null) {
    setBusyRequestId(affiliateRequest.id);
    try {
      await sendSellerApiRequest(`/seller/affiliates/requests/${encodeURIComponent(affiliateRequest.id)}/${decision}`, { method: "POST", body: reason ? { reason } : {} });
      showToast(decision === "approve" ? `@${affiliateRequest.creator.username} can now sell your products.` : `Declined @${affiliateRequest.creator.username}.`);
      setRequestBeingDeclined(null);
      setDeclineReason("");
      requestsQuery.reload();
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setBusyRequestId(null);
    }
  }

  const requests = requestsQuery.data?.data ?? [];
  const isDeclineReasonTooLong = declineReason.trim().length > maximumDeclineReasonLength;

  return (
    <>
      <SegmentedControl label="Request status" value={statusFilter} onValueChange={setStatusFilter} options={statusOptions} />
      <Panel padded={false}>
        {requestsQuery.isLoading && !requestsQuery.data ? <LoadingBlock /> : null}
        {requestsQuery.errorMessage ? <ErrorCallout message={requestsQuery.errorMessage} onRetry={requestsQuery.reload} /> : null}
        {!requestsQuery.isLoading && requests.length === 0 ? <EmptyState iconName="videoCamera24" title={statusFilter === "pending" ? "No requests waiting" : "Nothing here"} description="Creators in the Creator Program can ask to sell your products. Their requests show up here." /> : null}
        <ul className={styles.requestList}>
          {requests.map((affiliateRequest) => (
            <li key={affiliateRequest.id} className={styles.requestItem}>
              <AffiliateCreatorIdentity creator={affiliateRequest.creator} />
              <div className={styles.inlineRow}>
                {affiliateRequest.status === "pending" ? (
                  <>
                    <Button size="small" onClick={() => setRequestBeingDeclined(affiliateRequest)} disabled={busyRequestId !== null}>
                      Decline
                    </Button>
                    <Button size="small" variant="primary" isBusy={busyRequestId === affiliateRequest.id} disabled={busyRequestId !== null} onClick={() => void answerCreatorRequest(affiliateRequest, "approve", null)}>
                      Approve
                    </Button>
                  </>
                ) : (
                  <StatusBadge tone={affiliateRequest.status === "approved" ? "success" : "neutral"}>{affiliateRequest.status === "approved" ? "Approved" : "Declined"}</StatusBadge>
                )}
              </div>
              <p className={styles.requestMessage}>
                “{affiliateRequest.message}” <span className={styles.muted}>· {formatRelativeTimeFromNow(affiliateRequest.requestedAt)}</span>
                {affiliateRequest.decisionReason ? <><br />Your reason: {affiliateRequest.decisionReason}</> : null}
              </p>
            </li>
          ))}
        </ul>
      </Panel>
      <ModalDialog
        isOpen={requestBeingDeclined !== null}
        title={`Decline @${requestBeingDeclined?.creator.username ?? ""}?`}
        description="The creator is told you declined. A reason is optional but helps them."
        onClose={() => setRequestBeingDeclined(null)}
        width="small"
        footer={
          <>
            <Button onClick={() => setRequestBeingDeclined(null)}>Keep request</Button>
            <Button variant="danger" disabled={isDeclineReasonTooLong} isBusy={busyRequestId !== null} onClick={() => requestBeingDeclined && void answerCreatorRequest(requestBeingDeclined, "decline", declineReason.trim() || null)}>
              Decline request
            </Button>
          </>
        }
      >
        <TextAreaField label="Reason (optional)" value={declineReason} onChange={(event) => setDeclineReason(event.target.value)} maxLength={maximumDeclineReasonLength + 50} errorMessage={isDeclineReasonTooLong ? `Keep it under ${maximumDeclineReasonLength} characters.` : null} />
      </ModalDialog>
    </>
  );
}
