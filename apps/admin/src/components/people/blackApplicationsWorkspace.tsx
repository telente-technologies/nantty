"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { ErrorBlock, NoticeBanner } from "@/components/ui/feedback";
import { CheckboxField } from "@/components/ui/formFields";
import { PageHeader } from "@/components/ui/pageHeader";
import { SidePanel } from "@/components/ui/sidePanel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { KeyValueList, SectionHeading } from "@/components/ui/surfaces";
import { LinkTabs, SegmentedTabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toastProvider";
import { UserIdentity } from "@/components/ui/userIdentity";
import { verificationViewTabs } from "@/constants/identityVerification.constant";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import {
  decideBlackAppeal,
  decideBlackApplication,
  fetchBlackAppeals,
  fetchBlackApplications,
  sendBlackReverificationReminder,
  updateBlackChecklistItem,
  updateBlackCheckoutAuthorization,
} from "@/services/safetyApi.service";
import type { BlackAppeal, BlackApplication } from "@/types/blackApplications.type";
import { formatDateOnly, formatDateTime, formatRelativeTimeFromNow } from "@/utils/formatting.util";

import { BlackBillingAdminPanel } from "./blackBillingAdminPanel";
import styles from "./peopleWorkspace.module.css";

const tabs = [
  { key: "OPEN", label: "Needs review" },
  { key: "REVERIFY", label: "Approved & re-verification" },
  { key: "APPEALS", label: "Appeals" },
  { key: "BILLING", label: "USD billing" },
  { key: "ALL", label: "All" },
] as const;
type Decision = "approve" | "reject" | "revoke" | "require-reverification";

const columns: readonly DataTableColumn<BlackApplication>[] = [
  { key: "agency", header: "Agency", render: (item) => <UserIdentity user={{ ...item.user, displayName: item.agencyName }} /> },
  { key: "handle", header: "Handle", isMono: true, render: (item) => `@${item.handle}` },
  { key: "jurisdiction", header: "Jurisdiction", isMono: true, render: (item) => item.jurisdictionCountryCode || "—" },
  { key: "email", header: "Institutional email", render: (item) => `${item.institutionalEmail || "—"}${item.institutionalEmailVerified ? " ✓" : " (unverified)"}` },
  { key: "checks", header: "Vetting", render: (item) => `${item.checklist.filter((check) => check.isVerified).length}/${item.checklist.length}` },
  { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} /> },
  { key: "due", header: "Re-verify by", render: (item) => (item.reverificationDueAt ? formatDateOnly(item.reverificationDueAt) : "") },
  { key: "submitted", header: "Submitted", render: (item) => formatRelativeTimeFromNow(item.submittedAt) },
];

function ReviewPanel({ application, onClose, onChanged }: { readonly application: BlackApplication; readonly onClose: () => void; readonly onChanged: (updated: BlackApplication) => void }) {
  const { showToast } = useToast();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [checkoutAuthTarget, setCheckoutAuthTarget] = useState<boolean | null>(null);
  const checklistMutation = useAdminMutation((input: { key: BlackApplication["checklist"][number]["key"]; isVerified: boolean }) => updateBlackChecklistItem(application.id, input));
  const decisionMutation = useAdminMutation((input: { decision: Decision; reason: string }) => decideBlackApplication(application.id, input.decision, input.reason));
  const checkoutAuthMutation = useAdminMutation((input: { enabled: boolean; reason: string }) =>
    updateBlackCheckoutAuthorization(application.id, { enabled: input.enabled, expiresInHours: input.enabled ? 336 : undefined, reason: input.reason }),
  );
  const reminderMutation = useAdminMutation(() => sendBlackReverificationReminder(application.id));
  const isOpen = application.status === "IN_REVIEW" || application.status === "AWAITING_SECOND_APPROVAL" || application.status === "REVERIFICATION_REQUIRED";
  const isSecondApproval = application.firstApproval !== null;

  async function toggle(key: BlackApplication["checklist"][number]["key"], isVerified: boolean) {
    const updated = await checklistMutation.run({ key, isVerified });
    if (updated) onChanged(updated);
  }

  async function confirm(reason: string) {
    if (!decision) return;
    const updated = await decisionMutation.run({ decision, reason });
    if (updated) {
      showToast(
        decision === "approve"
          ? updated.status === "APPROVED"
            ? "Two approvals recorded. Private USD checkout authorized (badge stays hidden until paid)."
            : "First approval recorded. A different admin must give the second."
          : decision === "reject"
            ? "Application rejected."
            : decision === "require-reverification"
              ? "Re-verification requested."
              : "Black verification revoked. The handle stays reserved.",
      );
      setDecision(null);
      onChanged(updated);
    }
  }

  return (
    <SidePanel isOpen onClose={onClose} width="wide" title={application.agencyName} subtitle={`${application.id} · @${application.handle}`}
      footer={<>
        {isOpen ? (
          <>
            <Button size="small" variant="primary" iconName="shield24" disabled={!application.institutionalEmailVerified} onClick={() => setDecision("approve")}>
              {isSecondApproval ? "Give second approval" : "Give first approval"}
            </Button>
            <Button size="small" variant="quietDanger" iconName="shield24" onClick={() => setDecision("reject")}>Reject</Button>
          </>
        ) : null}
        {application.status === "APPROVED" ? (
          <>
            <Button size="small" onClick={() => setCheckoutAuthTarget(!application.privateCheckoutEnabled)}>
              {application.privateCheckoutEnabled ? "Revoke private checkout" : "Authorize 14d private checkout"}
            </Button>
            <Button size="small" isBusy={reminderMutation.isRunning} onClick={async () => { const updated = await reminderMutation.run(undefined); if (updated) { showToast("Re-verification reminder sent."); onChanged(updated); } }}>
              Remind re-verify
            </Button>
            <Button size="small" variant="secondary" onClick={() => setDecision("require-reverification")}>Require re-verification</Button>
            <Button size="small" variant="quietDanger" iconName="shield24" onClick={() => setDecision("revoke")}>Revoke now</Button>
          </>
        ) : null}
      </>}>
      <UserIdentity user={application.user} size={36} />
      <KeyValueList columns={2} items={[
        { label: "Status", value: <StatusBadge status={application.status} /> },
        { label: "Jurisdiction", value: application.jurisdictionCountryCode || "Unset" },
        { label: "Institutional email", value: `${application.institutionalEmail || "None"} (${application.institutionalEmailVerified ? "Verified" : "Unverified"})` },
        { label: "Private USD checkout", value: application.privateCheckoutEnabled ? `Enabled${application.privateCheckoutExpiresAt ? ` until ${formatDateOnly(application.privateCheckoutExpiresAt)}` : ""}` : "Disabled" },
        { label: "Representative", value: `${application.representativeName}, ${application.representativeRole}` },
        { label: "Legal entity", value: `${application.legalIdentityName || application.agencyName}${application.legalRegistrationRef ? ` (${application.legalRegistrationRef})` : ""}` },
        { label: "First approval", value: application.firstApproval ? `${application.firstApproval.name} · ${formatDateTime(application.firstApproval.at)}` : "Not yet" },
        { label: "Second approval", value: application.secondApproval ? `${application.secondApproval.name} · ${formatDateTime(application.secondApproval.at)}` : "Not yet" },
        { label: "Handle reserved", value: application.handleReserved ? "Yes, even if billing lapses" : "On approval" },
        { label: "Re-verify by", value: application.reverificationDueAt ? formatDateOnly(application.reverificationDueAt) : "After approval, yearly" },
      ]} />
      <NoticeBanner tone="info" title="Two admins + verified institutional email + paid USD billing">
        Institutional email OTP confirms domain control only. Approval requires two different admins with step-up, reserves the handle, and opens private monthly USD checkout ($300 Nigeria / $500 international). The Black badge goes live only after server-verified payment with a valid recurring card.
      </NoticeBanner>
      {application.decisionReason ? <NoticeBanner tone="caution" title="Decision note">{application.decisionReason}</NoticeBanner> : null}
      <SectionHeading>Vetting checklist</SectionHeading>
      <ul className={styles.stack} style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {application.checklist.map((item) => (
          <li key={item.key}>
            <CheckboxField label={<strong>{item.label}</strong>} description={`${item.detail}${item.verifiedByName ? ` Checked by ${item.verifiedByName}.` : ""}`} checked={item.isVerified} disabled={!isOpen || checklistMutation.isRunning} onChange={(event) => void toggle(item.key, event.target.checked)} />
          </li>
        ))}
      </ul>
      {checklistMutation.errorMessage ? <ErrorBlock error={checklistMutation.error} message={checklistMutation.errorMessage} /> : null}
      {decision ? (
        <ConfirmActionDialog
          intent="verify"
          isOpen
          title={
            decision === "approve"
              ? isSecondApproval
                ? "Give the second approval"
                : "Give the first approval"
              : decision === "reject"
                ? "Reject this application"
                : decision === "require-reverification"
                  ? "Require government re-verification"
                  : "Revoke the Black verification"
          }
          consequences={
            decision === "approve"
              ? [isSecondApproval ? "Handle is reserved and private USD checkout opens for 14 days. Badge stays hidden until paid." : "The application waits for a different admin to approve."]
              : decision === "revoke"
                ? ["Verification and private checkout are revoked immediately.", "The handle stays reserved."]
                : decision === "require-reverification"
                  ? ["Private checkout is paused until re-verification passes."]
                  : []
          }
          confirmLabel={decision === "approve" ? "Approve" : decision === "reject" ? "Reject" : decision === "require-reverification" ? "Require re-verification" : "Revoke"}
          tone={decision === "approve" ? "default" : "danger"}
          requiresStepUp
          isBusy={decisionMutation.isRunning}
          errorMessage={decisionMutation.errorMessage}
          onConfirm={confirm}
          onClose={() => { decisionMutation.clearError(); setDecision(null); }}
        />
      ) : null}
      {checkoutAuthTarget !== null ? (
        <ConfirmActionDialog
          intent="verify"
          isOpen
          title={checkoutAuthTarget ? "Authorize private USD checkout (14 days)" : "Revoke private USD checkout authorization"}
          consequences={[checkoutAuthTarget ? "Approved government profile can complete private monthly USD checkout." : "New Black checkout attempts will be blocked."]}
          confirmLabel={checkoutAuthTarget ? "Authorize" : "Revoke"}
          requiresStepUp
          isBusy={checkoutAuthMutation.isRunning}
          errorMessage={checkoutAuthMutation.errorMessage}
          onConfirm={async (reason) => {
            const updated = await checkoutAuthMutation.run({ enabled: checkoutAuthTarget, reason });
            if (updated) {
              showToast(checkoutAuthTarget ? "Private checkout authorized for 14 days." : "Private checkout revoked.");
              setCheckoutAuthTarget(null);
              onChanged(updated);
            }
          }}
          onClose={() => { checkoutAuthMutation.clearError(); setCheckoutAuthTarget(null); }}
        />
      ) : null}
    </SidePanel>
  );
}

function BlackAppealsPanel() {
  const { showToast } = useToast();
  const { data, error, errorMessage, isLoading, reload } = useAdminQuery((signal) => fetchBlackAppeals(undefined, signal), "black-appeals");
  const [deciding, setDeciding] = useState<{ appeal: BlackAppeal; decision: "reopen_review" | "uphold" } | null>(null);
  const decideMutation = useAdminMutation((input: { appealId: string; decision: "reopen_review" | "uphold"; note: string }) =>
    decideBlackAppeal(input.appealId, { decision: input.decision, note: input.note }),
  );
  const appealColumns: readonly DataTableColumn<BlackAppeal>[] = [
    { key: "app", header: "Application", isMono: true, render: (row) => row.applicationId },
    { key: "reason", header: "Appeal reason", render: (row) => row.reason },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status.toUpperCase()} /> },
    { key: "created", header: "Submitted", render: (row) => formatRelativeTimeFromNow(row.createdAt) },
    {
      key: "actions",
      header: "Decision",
      render: (row) => row.status === "pending" ? (
        <div style={{ display: "flex", gap: "0.4rem" }}>
          <Button size="small" variant="primary" onClick={() => setDeciding({ appeal: row, decision: "reopen_review" })}>Reopen review</Button>
          <Button size="small" variant="quietDanger" onClick={() => setDeciding({ appeal: row, decision: "uphold" })}>Uphold</Button>
        </div>
      ) : (row.decisionNote ?? "Decided"),
    },
  ];
  return (
    <>
      {errorMessage ? <ErrorBlock error={error} message={errorMessage} onRetry={reload} /> : null}
      <DataTable caption="Black verification appeals" columns={appealColumns} rows={data?.items ?? []} readRowKey={(row) => row.id} isLoading={isLoading} emptyMessage="No appeals submitted." />
      {deciding ? (
        <ConfirmActionDialog
          intent="verify"
          isOpen
          title={deciding.decision === "reopen_review" ? "Approve appeal & reopen review" : "Uphold previous decision"}
          consequences={[deciding.decision === "reopen_review" ? "Application moves back to IN_REVIEW for fresh two-admin vetting." : "Previous rejection or revocation remains final."]}
          confirmLabel={deciding.decision === "reopen_review" ? "Reopen review" : "Uphold"}
          tone={deciding.decision === "reopen_review" ? "default" : "danger"}
          requiresStepUp
          isBusy={decideMutation.isRunning}
          errorMessage={decideMutation.errorMessage}
          onConfirm={async (note) => {
            await decideMutation.run({ appealId: deciding.appeal.id, decision: deciding.decision, note });
            showToast(deciding.decision === "reopen_review" ? "Appeal approved; application reopened." : "Appeal upheld.");
            setDeciding(null);
            reload();
          }}
          onClose={() => { decideMutation.clearError(); setDeciding(null); }}
        />
      ) : null}
    </>
  );
}

export function BlackApplicationsWorkspace() {
  const [status, setStatus] = useState<(typeof tabs)[number]["key"]>("OPEN");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const isApplicationsTab = status === "OPEN" || status === "REVERIFY" || status === "ALL";
  const { data, errorMessage, error: queryError, isLoading, reload, replaceData } = useAdminQuery(
    (signal) => (isApplicationsTab ? fetchBlackApplications({ status }, signal) : Promise.resolve({ items: [], page: 1, pageSize: 20, total: 0 })),
    status,
  );
  const selected = data?.items.find((item) => item.id === selectedId) ?? null;
  return (
    <>
      <PageHeader area="People" title="Black applications & government billing" description="Government and official accounts. Vetted manually with institutional email OTP and two-admin approval before private monthly USD billing." />
      <LinkTabs label="Verification views" items={verificationViewTabs} />
      <SegmentedTabs label="Application status" items={tabs} activeKey={status} onChange={setStatus} />
      {status === "BILLING" ? <BlackBillingAdminPanel /> : null}
      {status === "APPEALS" ? <BlackAppealsPanel /> : null}
      {isApplicationsTab ? (
        <>
          {errorMessage ? <ErrorBlock error={queryError} message={errorMessage} onRetry={reload} /> : null}
          <DataTable caption="Black applications" columns={columns} rows={data?.items ?? []} readRowKey={(item) => item.id} onRowOpen={(item) => setSelectedId(item.id)} selectedRowKey={selectedId} isLoading={isLoading} emptyMessage="No applications here." />
        </>
      ) : null}
      {selected ? <ReviewPanel key={selected.id} application={selected} onClose={() => setSelectedId(null)} onChanged={(updated) => { replaceData((current) => current ? { ...current, items: current.items.map((item) => item.id === updated.id ? updated : item) } : current); reload(); }} /> : null}
    </>
  );
}
