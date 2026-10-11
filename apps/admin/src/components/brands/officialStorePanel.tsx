"use client";

import { useState } from "react";

import { useAdminPermissions } from "@/components/session/adminSessionProvider";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { EmptyState, NoticeBanner } from "@/components/ui/feedback";
import { StatusBadge, type BadgeTone } from "@/components/ui/statusBadge";
import { Card, KeyValueList } from "@/components/ui/surfaces";
import { useToast } from "@/components/ui/toastProvider";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { decideOfficialStoreStatus } from "@/services/brandsApi.service";
import type { AutomatedCheckOutcome, BrandDetail, BrandDocumentSummary, OfficialStoreDecisionAction } from "@/types/brands.type";
import { formatDateOnly, formatDateTime } from "@/utils/formatting.util";

import { BrandDocumentViewer } from "./brandDocumentViewer";
import styles from "./brands.module.css";

const checkTone: Record<AutomatedCheckOutcome, BadgeTone> = { PASS: "success", WARN: "caution", FAIL: "danger" };

const decisionCopy: Record<OfficialStoreDecisionAction, { buttonLabel: string; title: string; confirmLabel: string; tone: "default" | "danger"; consequences: string[] }> = {
  approve: { buttonLabel: "Approve Official Store", title: "Approve Official Store", confirmLabel: "Approve", tone: "default", consequences: ["Verified linked stores get the \"Official Store\" badge.", "This is a Gold business verification: the brand keeps Zudomart Dashboard access.", "The brand owner is notified."] },
  reject: { buttonLabel: "Reject", title: "Reject Official Store request", confirmLabel: "Reject request", tone: "danger", consequences: ["The brand stays unofficial and can apply again with new documents.", "The owner sees your reason."] },
  "request-info": { buttonLabel: "Request more info", title: "Ask the brand for more information", confirmLabel: "Send request", tone: "default", consequences: ["The request moves to Needs info and leaves the review queue.", "The owner sees your message and can upload new documents."] },
  revoke: { buttonLabel: "Revoke official status", title: "Revoke Official Store status", confirmLabel: "Revoke status", tone: "danger", consequences: ["The \"Official Store\" badge is removed from every linked store now.", "Trademark claims filed by this brand are treated as unverified until reinstated.", "The brand owner is notified with your reason."] },
};

export function OfficialStorePanel({ brand, onChanged }: { readonly brand: BrandDetail; readonly onChanged: (updated: BrandDetail) => void }) {
  const { can } = useAdminPermissions();
  const { showToast } = useToast();
  const [openDocument, setOpenDocument] = useState<BrandDocumentSummary | null>(null);
  const [pendingAction, setPendingAction] = useState<OfficialStoreDecisionAction | null>(null);
  const decision = useAdminMutation((input: { action: OfficialStoreDecisionAction; reason: string }) => decideOfficialStoreStatus(brand.id, input.action, input.reason));
  const request = brand.officialRequest;

  async function confirmDecision(reason: string) {
    if (!pendingAction) return;
    const updated = await decision.run({ action: pendingAction, reason });
    if (!updated) return;
    showToast(`${decisionCopy[pendingAction].confirmLabel}: done for ${brand.name}.`);
    setPendingAction(null);
    onChanged(updated);
  }

  const visibleActions = brand.allowedOfficialActions.filter((action) => (action === "revoke" ? can("brands:revoke") : can("brands:review")));
  if (!request) return <Card title="Official Store"><EmptyState title="No Official Store request yet" description="The brand owner applies from the Zudomart Dashboard with a trademark certificate, CAC certificate and authorisation letter." /></Card>;
  return (
    <div className={styles.layoutStack}>
      {brand.officialStatus === "OFFICIAL" ? <NoticeBanner tone="success" title="Official Store">Verified linked stores show the badge. Gold verification also grants Zudomart Dashboard access.</NoticeBanner> : null}
      {request.lastDecisionReason ? <NoticeBanner tone="info" title={`Last decision by ${request.decidedByName ?? "an admin"} · ${formatDateTime(request.decidedAt)}`}>{request.lastDecisionReason}</NoticeBanner> : null}
      <Card title="Trademark and company">
        <KeyValueList
          columns={3}
          items={[
            { label: "Registration number", value: request.trademark.registrationNumber, isMono: true },
            { label: "Jurisdiction", value: request.trademark.jurisdiction },
            { label: "Class", value: String(request.trademark.niceClass) },
            { label: "Registered owner", value: request.trademark.registeredOwner },
            { label: "Registered on", value: formatDateOnly(request.trademark.registeredOn) },
            { label: "Expires", value: formatDateOnly(request.trademark.expiresOn) },
            { label: "Company (CAC)", value: request.cacCompanyName },
            { label: "CAC number", value: request.cacRegistrationNumber, isMono: true },
            { label: "Contact email", value: request.contactEmail, isMono: true },
            { label: "Submitted", value: `${formatDateTime(request.submittedAt)}${request.submittedBy ? ` by @${request.submittedBy.username}` : ""}` },
          ]}
        />
      </Card>
      <Card title="Automated checks">
        <ul className={styles.checkList}>
          {request.checks.map((check) => (
            <li key={check.key}>
              <StatusBadge label={check.outcome} tone={checkTone[check.outcome]} />
              <span>
                <span className={styles.checkLabel}>{check.label}</span>
                <br />
                <span className={styles.muted}>{check.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Documents">
        <ul className={styles.documentList}>
          {request.documents.map((document) => (
            <li key={document.id}>
              <span>
                <strong>{document.label}</strong>
                <span className={styles.muted}> · uploaded {formatDateOnly(document.uploadedAt)}</span>
              </span>
              {can("brands:review") ? <Button size="small" iconName="eye16" onClick={() => setOpenDocument(document)}>Open</Button> : null}
            </li>
          ))}
        </ul>
      </Card>
      {visibleActions.length > 0 ? (
        <div className={styles.actionRow}>
          {visibleActions.map((action) => (
            <Button key={action} variant={action === "approve" ? "primary" : decisionCopy[action].tone === "danger" ? "quietDanger" : "secondary"} iconName={action === "revoke" ? "shield24" : undefined} onClick={() => setPendingAction(action)}>
              {decisionCopy[action].buttonLabel}
            </Button>
          ))}
        </div>
      ) : null}
      {openDocument ? <BrandDocumentViewer brandId={brand.id} request={request} document={openDocument} onClose={() => setOpenDocument(null)} /> : null}
      {pendingAction ? (
        <ConfirmActionDialog intent="store"
          isOpen
          title={decisionCopy[pendingAction].title}
          confirmLabel={decisionCopy[pendingAction].confirmLabel}
          tone={decisionCopy[pendingAction].tone}
          consequences={decisionCopy[pendingAction].consequences}
          requiresStepUp={pendingAction === "revoke"}
          typedConfirmationText={pendingAction === "revoke" ? brand.slug : undefined}
          isBusy={decision.isRunning}
          errorMessage={decision.errorMessage}
          onConfirm={confirmDecision}
          onClose={() => {
            decision.clearError();
            setPendingAction(null);
          }}
        />
      ) : null}
    </div>
  );
}
