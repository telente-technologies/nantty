"use client";

import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { GateStep } from "@/components/billing/gateFrame";
import { Callout, ErrorCallout, LoadingBlock } from "@/components/ui/feedback";
import { Panel, PageHeader } from "@/components/ui/panel";
import { StatusBadge, type StatusTone } from "@/components/ui/statusBadge";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import type { VerificationStatus } from "@/types/sellerAccess.type";

interface VerificationDocument {
  readonly kind: string;
  readonly label: string;
  readonly status: "missing" | "in_review" | "approved" | "rejected";
}

export interface VerificationDetails {
  readonly status: VerificationStatus;
  readonly note: string | null;
  readonly submittedAt: string | null;
  readonly documents: VerificationDocument[];
}

const documentStatusTone: Record<VerificationDocument["status"], StatusTone> = { missing: "neutral", in_review: "info", approved: "success", rejected: "error" };
const documentStatusLabel: Record<VerificationDocument["status"], string> = { missing: "Not sent", in_review: "In review", approved: "Approved", rejected: "Needs attention" };

const headlineByStatus: Record<VerificationStatus, { title: string; description: string }> = {
  unverified: { title: "Your store is not verified yet", description: "You can use the dashboard on any plan. Verifying adds the gold badge and builds trust with buyers." },
  pending: { title: "We are reviewing your store", description: "You can keep using the dashboard while we review. You will get a notification in the Nantty app when we are done." },
  verified: { title: "Your store is verified", description: "Your store shows the gold badge." },
  suspended: { title: "Your store is restricted", description: "Selling tools are paused while we look into your account. Check the note below and contact support." },
  revoked: { title: "Your store was removed", description: "Your store can no longer sell on Nantty. Read the note below to find out how to apply again." },
};

export function VerificationDocumentsList({ details }: { readonly details: VerificationDetails }) {
  return (
    <ul>
      {details.documents.map((document) => (
        <li key={document.kind} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--divider-soft)" }}>
          <span>{document.label}</span>
          <StatusBadge tone={documentStatusTone[document.status]}>{documentStatusLabel[document.status]}</StatusBadge>
        </li>
      ))}
    </ul>
  );
}

export function VerificationStatusView() {
  const { sessionView } = useSellerSession();
  const verificationQuery = useSellerQuery<VerificationDetails>("/seller/verification");
  const status = verificationQuery.data?.status ?? sessionView?.access.verification.status ?? "unverified";
  const headline = headlineByStatus[status];
  return (
    <>
      <PageHeader eyebrow={sessionView?.access.storeName ?? "Your store"} title={headline.title} description={headline.description} />
      {verificationQuery.data?.note ? <Callout tone={status === "pending" ? "info" : "caution"} title="Note from Nantty">{verificationQuery.data.note}</Callout> : null}
      <Panel title="What to do next">
        <ol>
          <GateStep state="current" title="Read the note from Nantty" />
          <GateStep state="todo" title="Reply to support from the Nantty app" />
          <GateStep state="todo" title="Sign in again once the restriction is lifted" />
        </ol>
      </Panel>
      <Panel title="Documents">
        {verificationQuery.isLoading ? <LoadingBlock /> : verificationQuery.data ? <VerificationDocumentsList details={verificationQuery.data} /> : <ErrorCallout error={verificationQuery.error} message={verificationQuery.errorMessage} onRetry={verificationQuery.reload} />}
      </Panel>
    </>
  );
}
