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
import { decideBlackApplication, fetchBlackApplications, sendBlackReverificationReminder, updateBlackChecklistItem } from "@/services/safetyApi.service";
import type { BlackApplication } from "@/types/blackApplications.type";
import { formatDateOnly, formatDateTime, formatRelativeTimeFromNow } from "@/utils/formatting.util";

import styles from "./peopleWorkspace.module.css";

const tabs = [{ key: "OPEN", label: "Needs review" }, { key: "REVERIFY", label: "Approved and re-verification" }, { key: "ALL", label: "All" }] as const;
type Decision = "approve" | "reject" | "revoke";

const columns: readonly DataTableColumn<BlackApplication>[] = [
  { key: "agency", header: "Agency", render: (item) => <UserIdentity user={{ ...item.user, displayName: item.agencyName }} /> },
  { key: "handle", header: "Handle", isMono: true, render: (item) => `@${item.handle}` },
  { key: "rep", header: "Representative", render: (item) => `${item.representativeName}, ${item.representativeRole}` },
  { key: "checks", header: "Vetting", render: (item) => `${item.checklist.filter((check) => check.isVerified).length}/${item.checklist.length}` },
  { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} /> },
  { key: "due", header: "Re-verify by", render: (item) => (item.reverificationDueAt ? formatDateOnly(item.reverificationDueAt) : "") },
  { key: "submitted", header: "Submitted", render: (item) => formatRelativeTimeFromNow(item.submittedAt) },
];

function ReviewPanel({ application, onClose, onChanged }: { readonly application: BlackApplication; readonly onClose: () => void; readonly onChanged: (updated: BlackApplication) => void }) {
  const { showToast } = useToast();
  const [decision, setDecision] = useState<Decision | null>(null);
  const checklistMutation = useAdminMutation((input: { key: BlackApplication["checklist"][number]["key"]; isVerified: boolean }) => updateBlackChecklistItem(application.id, input));
  const decisionMutation = useAdminMutation((input: { decision: Decision; reason: string }) => decideBlackApplication(application.id, input.decision, input.reason));
  const reminderMutation = useAdminMutation(() => sendBlackReverificationReminder(application.id));
  const isOpen = application.status === "IN_REVIEW" || application.status === "AWAITING_SECOND_APPROVAL";
  const isSecondApproval = application.firstApproval !== null;

  async function toggle(key: BlackApplication["checklist"][number]["key"], isVerified: boolean) {
    const updated = await checklistMutation.run({ key, isVerified });
    if (updated) onChanged(updated);
  }

  async function confirm(reason: string) {
    if (!decision) return;
    const updated = await decisionMutation.run({ decision, reason });
    if (updated) {
      showToast(decision === "approve" ? (updated.status === "APPROVED" ? "Black checkmark approved. Handle reserved." : "First approval recorded. A different admin must give the second.") : decision === "reject" ? "Application rejected." : "Black checkmark revoked. The handle stays reserved.");
      setDecision(null);
      onChanged(updated);
    }
  }

  return (
    <SidePanel isOpen onClose={onClose} width="wide" title={application.agencyName} subtitle={`${application.id} · @${application.handle}`}
      footer={<>
        {isOpen ? <><Button size="small" variant="primary" iconName="shield24" onClick={() => setDecision("approve")}>{isSecondApproval ? "Give second approval" : "Give first approval"}</Button><Button size="small" variant="quietDanger" iconName="shield24" onClick={() => setDecision("reject")}>Reject</Button></> : null}
        {application.status === "APPROVED" ? <><Button size="small" isBusy={reminderMutation.isRunning} onClick={async () => { const updated = await reminderMutation.run(undefined); if (updated) { showToast("Re-verification reminder sent."); onChanged(updated); } }}>Send re-verification reminder</Button><Button size="small" variant="quietDanger" iconName="shield24" onClick={() => setDecision("revoke")}>Revoke now</Button></> : null}
      </>}>
      <UserIdentity user={application.user} size={36} />
      <KeyValueList columns={2} items={[
        { label: "Status", value: <StatusBadge status={application.status} /> },
        { label: "Representative", value: `${application.representativeName}, ${application.representativeRole}` },
        { label: "First approval", value: application.firstApproval ? `${application.firstApproval.adminName} · ${formatDateTime(application.firstApproval.approvedAt)}` : "Not yet" },
        { label: "Second approval", value: application.secondApproval ? `${application.secondApproval.adminName} · ${formatDateTime(application.secondApproval.approvedAt)}` : "Not yet" },
        { label: "Handle reserved", value: application.handleReserved ? "Yes, even if billing lapses" : "On approval" },
        { label: "Re-verify by", value: application.reverificationDueAt ? formatDateOnly(application.reverificationDueAt) : "After approval, yearly" },
      ]} />
      <NoticeBanner tone="info" title="Two admins, both with step-up">Black needs two different admins. The checklist must be complete before either can approve. It is re-verified every year and whenever the representative changes.</NoticeBanner>
      {application.decisionReason ? <NoticeBanner tone="caution" title="Decision note">{application.decisionReason}</NoticeBanner> : null}
      <SectionHeading>Vetting checklist</SectionHeading>
      <ul className={styles.stack} style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {application.checklist.map((item) => (
          <li key={item.key}>
            <CheckboxField label={<strong>{item.label}</strong>} description={`${item.detail}${item.verifiedByName ? ` Checked by ${item.verifiedByName}.` : ""}`} checked={item.isVerified} disabled={!isOpen || checklistMutation.isRunning} onChange={(event) => void toggle(item.key, event.target.checked)} />
          </li>
        ))}
      </ul>
      {checklistMutation.errorMessage ? <ErrorBlock message={checklistMutation.errorMessage} /> : null}
      {decision ? <ConfirmActionDialog isOpen title={decision === "approve" ? (isSecondApproval ? "Give the second approval" : "Give the first approval") : decision === "reject" ? "Reject this application" : "Revoke the Black checkmark"} consequences={decision === "approve" ? [isSecondApproval ? "The Black checkmark goes live and the handle is reserved." : "The application waits for a different admin to approve."] : decision === "revoke" ? ["The badge is removed straight away.", "The handle stays reserved."] : []} confirmLabel={decision === "approve" ? "Approve" : decision === "reject" ? "Reject" : "Revoke"} tone={decision === "approve" ? "default" : "danger"} requiresStepUp isBusy={decisionMutation.isRunning} errorMessage={decisionMutation.errorMessage} onConfirm={confirm} onClose={() => { decisionMutation.clearError(); setDecision(null); }} /> : null}
    </SidePanel>
  );
}

export function BlackApplicationsWorkspace() {
  const [status, setStatus] = useState<(typeof tabs)[number]["key"]>("OPEN");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data, errorMessage, isLoading, reload, replaceData } = useAdminQuery((signal) => fetchBlackApplications({ status }, signal), status);
  const selected = data?.items.find((item) => item.id === selectedId) ?? null;
  return (
    <>
      <PageHeader area="People" title="Black applications" description="Government and official accounts. Never suggested or self-serve, always vetted by hand and approved by two admins." />
      <LinkTabs label="Verification views" items={verificationViewTabs} />
      <SegmentedTabs label="Application status" items={tabs} activeKey={status} onChange={setStatus} />
      {errorMessage ? <ErrorBlock message={errorMessage} onRetry={reload} /> : null}
      <DataTable caption="Black applications" columns={columns} rows={data?.items ?? []} readRowKey={(item) => item.id} onRowOpen={(item) => setSelectedId(item.id)} selectedRowKey={selectedId} isLoading={isLoading} emptyMessage="No applications here." />
      {selected ? <ReviewPanel key={selected.id} application={selected} onClose={() => setSelectedId(null)} onChanged={(updated) => { replaceData((current) => current ? { ...current, items: current.items.map((item) => item.id === updated.id ? updated : item) } : current); reload(); }} /> : null}
    </>
  );
}
