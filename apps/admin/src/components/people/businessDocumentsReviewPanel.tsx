"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { ErrorBlock, LoadingBlock, NoticeBanner } from "@/components/ui/feedback";
import { ModalDialog } from "@/components/ui/modalDialog";
import { SidePanel } from "@/components/ui/sidePanel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { KeyValueList, SectionHeading } from "@/components/ui/surfaces";
import { useToast } from "@/components/ui/toastProvider";
import { UserIdentity } from "@/components/ui/userIdentity";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { openBusinessDocument, reviewBusinessDocument } from "@/services/safetyApi.service";
import type { BusinessDocumentItem, BusinessDocumentSubmission } from "@/types/businessDocuments.type";
import { formatDateTime, humanizeConstantName } from "@/utils/formatting.util";

import styles from "./peopleWorkspace.module.css";

const kindLabels = { CAC_CERTIFICATE: "CAC certificate", ID: "Government ID", PROOF_OF_ADDRESS: "Proof of address" } as const;

function DocumentViewer({ submissionId, item, onClose }: { readonly submissionId: string; readonly item: BusinessDocumentItem; readonly onClose: () => void }) {
  const { data: access, errorMessage, error: queryError, isLoading, reload } = useAdminQuery((signal) => openBusinessDocument(submissionId, item.id, signal), item.id);
  return (
    <ModalDialog isOpen title={kindLabels[item.kind]} description={access ? `Private link expires ${formatDateTime(access.expiresAt)}. This view is logged.` : "Opening a short-lived private link…"} onClose={onClose} width="wide" tone="secure">
      {errorMessage ? <ErrorBlock error={queryError} message={errorMessage} onRetry={reload} /> : null}
      {isLoading && !access ? <LoadingBlock lines={5} /> : null}
      {access ? <div onContextMenu={(event) => event.preventDefault()} className={styles.stack}><p className={styles.muted}>{access.fileName}</p><p className={styles.faint}>{access.watermarkText}</p></div> : null}
    </ModalDialog>
  );
}

export function BusinessDocumentsReviewPanel({ submission, onClose, onChanged }: { readonly submission: BusinessDocumentSubmission; readonly onClose: () => void; readonly onChanged: (updated: BusinessDocumentSubmission) => void }) {
  const { showToast } = useToast();
  const [viewing, setViewing] = useState<BusinessDocumentItem | null>(null);
  const [decision, setDecision] = useState<{ item: BusinessDocumentItem; kind: "approve" | "reject" } | null>(null);
  const mutation = useAdminMutation((input: { item: BusinessDocumentItem; kind: "approve" | "reject"; reason: string }) => reviewBusinessDocument(submission.id, input.item.id, input.kind, input.reason));

  async function confirm(reason: string) {
    if (!decision) return;
    const updated = await mutation.run({ ...decision, reason });
    if (updated) {
      showToast(`${kindLabels[decision.item.kind]} ${decision.kind === "approve" ? "approved" : "rejected"}. Logged to the audit trail.`);
      setDecision(null);
      onChanged(updated);
    }
  }

  const paidPlan = submission.plan !== "FREE";
  return (
    <SidePanel isOpen onClose={onClose} width="wide" title={submission.storeName} subtitle={`${submission.id} · plan ${humanizeConstantName(submission.plan)}`}>
      <UserIdentity user={submission.user} size={36} />
      <KeyValueList columns={3} items={[{ label: "Overall", value: <StatusBadge status={submission.overallStatus} /> }, { label: "Plan", value: humanizeConstantName(submission.plan) }, { label: "Gold checkmark", value: humanizeConstantName(submission.goldCheckmark) }]} />
      <NoticeBanner tone={paidPlan ? "info" : "caution"} title={paidPlan ? "Approving all three grants Gold" : "This store is on the Free plan"}>
        {paidPlan ? "Once the CAC certificate, ID and proof of address are all approved, the store gets the Gold checkmark automatically." : "Approval is recorded, but Gold only appears once the seller is on Pro or Business."}
      </NoticeBanner>
      <SectionHeading>Documents</SectionHeading>
      <ul className={styles.stack} style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {submission.documents.map((item) => (
          <li key={item.id} className={styles.stack} style={{ gap: 6, padding: 10, border: "1px solid var(--divider)", borderRadius: "var(--radius-medium)" }}>
            <span className={styles.row}><strong>{kindLabels[item.kind]}</strong><StatusBadge status={item.status} /></span>
            <span className={styles.faint}>{item.fileName} · uploaded {formatDateTime(item.uploadedAt)}</span>
            {item.rejectionReason ? <span className={styles.muted}>Rejected: {item.rejectionReason}</span> : null}
            <span className={styles.row}>
              <Button size="small" variant="ghost" onClick={() => setViewing(item)}>View</Button>
              {item.status === "PENDING" ? (<><Button size="small" onClick={() => setDecision({ item, kind: "approve" })}>Approve</Button><Button size="small" variant="quietDanger" onClick={() => setDecision({ item, kind: "reject" })}>Reject</Button></>) : null}
            </span>
          </li>
        ))}
      </ul>
      {viewing ? <DocumentViewer submissionId={submission.id} item={viewing} onClose={() => setViewing(null)} /> : null}
      {decision ? (
        <ConfirmActionDialog intent="verify" isOpen title={`${decision.kind === "approve" ? "Approve" : "Reject"} ${kindLabels[decision.item.kind]}`} confirmLabel={decision.kind === "approve" ? "Approve document" : "Reject document"} tone={decision.kind === "reject" ? "danger" : "default"} reasonLabel={decision.kind === "reject" ? "Why it was rejected (the seller sees this)" : "Note (saved to the audit log)"} consequences={decision.kind === "reject" ? ["The seller is told what to fix and can upload a new file."] : []} isBusy={mutation.isRunning} errorMessage={mutation.errorMessage} onConfirm={confirm} onClose={() => { mutation.clearError(); setDecision(null); }} />
      ) : null}
    </SidePanel>
  );
}
