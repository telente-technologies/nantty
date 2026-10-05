"use client";

import { useRef, useState } from "react";

import { GoldCheckmarkPreview } from "@/components/documents/goldCheckmarkPreview";
import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { Button } from "@/components/ui/button";
import { Callout, ErrorCallout, LoadingBlock } from "@/components/ui/feedback";
import { Panel } from "@/components/ui/panel";
import { StatusBadge, type StatusTone } from "@/components/ui/statusBadge";
import { useToast } from "@/components/ui/toastProvider";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { BusinessDocumentKind, BusinessDocumentStatus, BusinessDocumentsOverview, BusinessDocumentView } from "@/types/businessDocuments.type";
import { formatDateForDisplay } from "@/utils/dateFormatting.util";

const statusTone: Record<BusinessDocumentStatus, StatusTone> = { not_uploaded: "neutral", in_review: "info", approved: "success", rejected: "error" };
const statusLabel: Record<BusinessDocumentStatus, string> = { not_uploaded: "Not uploaded", in_review: "In review", approved: "Approved", rejected: "Needs a new file" };

function DocumentRow({ document, isBusy, onChoose }: { readonly document: BusinessDocumentView; readonly isBusy: boolean; readonly onChoose: (kind: BusinessDocumentKind, file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <li style={{ display: "flex", flexDirection: "column", gap: 6, padding: "12px 0", borderBottom: "1px solid var(--divider-soft)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <strong>{document.label}</strong>
        <StatusBadge tone={statusTone[document.status]}>{statusLabel[document.status]}</StatusBadge>
      </div>
      <span style={{ color: "var(--ink-muted)" }}>{document.description}</span>
      {document.fileName ? <span style={{ color: "var(--ink-faint)" }}>{document.fileName}{document.uploadedAt ? ` · sent ${formatDateForDisplay(document.uploadedAt)}` : ""}</span> : null}
      {document.rejectionReason ? <Callout tone="caution" title="Why it was not approved">{document.rejectionReason}</Callout> : null}
      {document.status !== "approved" ? (
        <div>
          <input ref={inputRef} type="file" accept="application/pdf,image/jpeg,image/png" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) onChoose(document.kind, file); event.target.value = ""; }} />
          <Button size="small" variant={document.status === "rejected" ? "primary" : "secondary"} isBusy={isBusy} onClick={() => inputRef.current?.click()}>{document.status === "not_uploaded" ? "Upload" : "Upload a new file"}</Button>
        </div>
      ) : null}
    </li>
  );
}

export function BusinessDocumentsView() {
  const { sessionView } = useSellerSession();
  const { showToast } = useToast();
  const query = useSellerQuery<BusinessDocumentsOverview>("/seller/business-documents");
  const [busyKind, setBusyKind] = useState<BusinessDocumentKind | null>(null);

  async function upload(kind: BusinessDocumentKind, file: File) {
    setBusyKind(kind);
    try {
      await sendSellerApiRequest(`/seller/business-documents/${kind}`, { method: "POST", body: { fileName: file.name, mimeType: file.type, sizeBytes: file.size } });
      showToast("Sent for review. You can keep selling while we look at it.");
      query.reload();
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setBusyKind(null);
    }
  }

  if (query.isLoading && !query.data) return <LoadingBlock label="Loading your documents" />;
  if (!query.data) return <ErrorCallout message={query.errorMessage ?? "Your documents could not be loaded."} onRetry={query.reload} />;
  return (
    <>
      <Callout tone="info" title="Selling never waits for this">You can create your store, list products and take orders without these documents. They unlock the Gold checkmark.</Callout>
      <GoldCheckmarkPreview storeName={sessionView?.access.storeName ?? "Your store"} goldCheckmark={query.data.goldCheckmark} />
      <Panel title="Business documents" description="PDF, JPEG or PNG, up to 10 MB each. Only the Zudomart review team can open them.">
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {query.data.documents.map((document) => <DocumentRow key={document.kind} document={document} isBusy={busyKind === document.kind} onChoose={(kind, file) => void upload(kind, file)} />)}
        </ul>
      </Panel>
    </>
  );
}
