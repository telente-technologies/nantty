"use client";

import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { GateStep } from "@/components/billing/gateFrame";
import { Callout, LoadingBlock } from "@/components/ui/feedback";
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
  unverified: { title: "Verify your store to use the dashboard", description: "Send your business documents from the Zudomart app. Once verified, pick a Gold plan to unlock the dashboard." },
  pending: { title: "We are reviewing your store", description: "You will get a notification in the Zudomart app when we are done. Nothing else is needed from you right now." },
  verified: { title: "Your store is verified", description: "Pick a Gold plan to unlock the dashboard." },
  suspended: { title: "Your verification is suspended", description: "Selling tools are paused while we look into your account. Check the note below and contact support." },
  revoked: { title: "Your verification was removed", description: "Your store no longer has a gold badge or dashboard access. Read the note below to find out how to apply again." },
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
      {verificationQuery.data?.note ? <Callout tone={status === "pending" ? "info" : "caution"} title="Note from Zudomart">{verificationQuery.data.note}</Callout> : null}
      <Panel title="Your path to the dashboard">
        <ol>
          <GateStep state={status === "unverified" ? "current" : "done"} title="Send your documents in the Zudomart app" />
          <GateStep state={status === "pending" ? "current" : status === "verified" ? "done" : "todo"} title="Verification review" />
          <GateStep state={status === "verified" ? "current" : "todo"} title="Choose Gold Pro or Gold Premium" />
        </ol>
      </Panel>
      <Panel title="Documents">
        {verificationQuery.isLoading ? <LoadingBlock /> : verificationQuery.data ? <VerificationDocumentsList details={verificationQuery.data} /> : <Callout tone="error">{verificationQuery.errorMessage}</Callout>}
      </Panel>
    </>
  );
}
