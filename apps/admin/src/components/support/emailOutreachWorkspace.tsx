"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { InlineError, NoticeBanner } from "@/components/ui/feedback";
import { SelectField, TextAreaField, TextField, readIssueMessageForField } from "@/components/ui/formFields";
import { PageHeader } from "@/components/ui/pageHeader";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Card, SectionHeading } from "@/components/ui/surfaces";
import { useToast } from "@/components/ui/toastProvider";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchEmailSegments, fetchEmailSends, fetchEmailTemplates, fetchFailedEmailDeliveries, previewSupportEmail, sendSupportEmail } from "@/services/supportOutreachApi.service";
import type { EmailAudience, EmailDraftInput, EmailKind, EmailPreview, EmailSendRecord, FailedEmailDeliveryRecord } from "@/types/supportOutreach.type";
import { formatDateTime, humanizeConstantName } from "@/utils/formatting.util";

const sendColumns: readonly DataTableColumn<EmailSendRecord>[] = [
  { key: "subject", header: "Subject", render: (item) => item.subject },
  { key: "kind", header: "Type", render: (item) => <StatusBadge label={humanizeConstantName(item.kind)} tone={item.kind === "MARKETING" ? "brand" : "neutral"} hasDot={false} /> },
  { key: "audience", header: "Audience", render: (item) => item.audienceLabel },
  { key: "count", header: "Sent", align: "end", isMono: true, render: (item) => item.recipientCount },
  { key: "skipped", header: "Skipped (no consent)", align: "end", isMono: true, render: (item) => item.skippedNoMarketingConsent },
  { key: "by", header: "Sent by", render: (item) => `${item.sentByName} · ${formatDateTime(item.sentAt)}` },
];

const failedDeliveryColumns: readonly DataTableColumn<FailedEmailDeliveryRecord>[] = [
  { key: "template", header: "Notification", render: (item) => item.templateKey ?? "Custom email" },
  { key: "event", header: "Event ID", render: (item) => item.eventId },
  { key: "attempts", header: "Attempts", align: "end", isMono: true, render: (item) => item.attemptCount },
  { key: "failed", header: "Stopped at", render: (item) => item.failedAt ? formatDateTime(item.failedAt) : "—" },
  { key: "reason", header: "Last error", render: (item) => item.reason ?? "No provider detail" },
];

export function EmailOutreachWorkspace() {
  const { showToast } = useToast();
  const templates = useAdminQuery((signal) => fetchEmailTemplates(signal), "templates");
  const segments = useAdminQuery((signal) => fetchEmailSegments(signal), "segments");
  const sends = useAdminQuery((signal) => fetchEmailSends(signal), "sends");
  const failedDeliveries = useAdminQuery((signal) => fetchFailedEmailDeliveries(signal), "failed-deliveries");
  const [audienceType, setAudienceType] = useState<"USER" | "SEGMENT">("USER");
  const [username, setUsername] = useState("");
  const [segmentId, setSegmentId] = useState("all-users");
  const [kind, setKind] = useState<EmailKind>("TRANSACTIONAL");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [preview, setPreview] = useState<EmailPreview | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const audience: EmailAudience = audienceType === "USER" ? { type: "USER", username } : { type: "SEGMENT", segmentId };
  const draft: EmailDraftInput = { kind, subject, body, audience };
  const previewMutation = useAdminMutation(previewSupportEmail);
  const sendMutation = useAdminMutation((reason: string) => sendSupportEmail({ ...draft, reason }));

  function applyTemplate(templateId: string) {
    const template = templates.data?.items.find((candidate) => candidate.id === templateId);
    if (!template) return;
    setKind(template.kind);
    setSubject(template.subject);
    setBody(template.body);
    setPreview(null);
  }

  async function confirmSend(reason: string) {
    const record = await sendMutation.run(reason);
    if (record) {
      showToast(`Queued ${record.recipientCount} email${record.recipientCount === 1 ? "" : "s"} through AWS SES.`);
      setIsConfirmOpen(false);
      setPreview(null);
      setSubject("");
      setBody("");
      sends.reload();
    }
  }

  const selectedSegment = segments.data?.items.find((segment) => segment.id === segmentId);
  const needsStepUp = audienceType === "SEGMENT" || kind === "MARKETING";
  return (
    <>
      <PageHeader area="Support" title="Email" description="Email one person or a segment through AWS SES. People are emailed at their verified account address, which you never see here." />
      <Card title="Compose">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <SelectField label="Start from a template" value="" options={[{ value: "", label: "Choose a template…" }, ...(templates.data?.items ?? []).map((template) => ({ value: template.id, label: `${template.name} (${humanizeConstantName(template.kind).toLowerCase()})` }))]} onChange={(event) => applyTemplate(event.target.value)} />
          <SelectField label="Audience" value={audienceType} onChange={(event) => { setAudienceType(event.target.value as "USER" | "SEGMENT"); setPreview(null); }} options={[{ value: "USER", label: "One person" }, { value: "SEGMENT", label: "A segment" }]} />
          {audienceType === "USER" ? <TextField label="Username" value={username} onChange={(event) => { setUsername(event.target.value); setPreview(null); }} autoComplete="off" error={readIssueMessageForField(previewMutation.validationIssues, "audience.username")} /> : (
            <SelectField label="Segment" value={segmentId} onChange={(event) => { setSegmentId(event.target.value); setPreview(null); }} options={(segments.data?.items ?? []).map((segment) => ({ value: segment.id, label: `${segment.label} (${segment.recipientCount})` }))} hint={selectedSegment ? `${selectedSegment.description} ${selectedSegment.marketingConsentCount} of ${selectedSegment.recipientCount} agreed to marketing.` : undefined} />
          )}
          <SelectField label="Type" value={kind} onChange={(event) => { setKind(event.target.value as EmailKind); setPreview(null); }} options={[{ value: "TRANSACTIONAL", label: "Service message (account, order, support)" }, { value: "MARKETING", label: "Marketing (needs marketing consent)" }]} />
          {kind === "MARKETING" ? <NoticeBanner tone="info" title="Marketing rules">Only people who agreed to marketing receive it, everyone else is skipped. An unsubscribe link is added automatically.</NoticeBanner> : null}
          <TextField label="Subject" value={subject} maxLength={150} onChange={(event) => { setSubject(event.target.value); setPreview(null); }} error={readIssueMessageForField(previewMutation.validationIssues, "subject")} />
          <TextAreaField label="Message" rows={8} maxLength={8000} value={body} onChange={(event) => { setBody(event.target.value); setPreview(null); }} hint="Use {{user.displayName}} to greet people by name." error={readIssueMessageForField(previewMutation.validationIssues, "body")} />
          {previewMutation.errorMessage ? <InlineError message={previewMutation.errorMessage} /> : null}
          <div><Button isBusy={previewMutation.isRunning} onClick={async () => setPreview(await previewMutation.run(draft))}>Preview and check recipients</Button></div>
        </div>
      </Card>
      {preview ? (
        <Card title="Preview">
          <SectionHeading actions={<StatusBadge label={`${preview.recipientCount} will receive it`} tone={preview.recipientCount > 0 ? "success" : "danger"} hasDot={false} />}>{preview.renderedSubject}</SectionHeading>
          <p style={{ whiteSpace: "pre-wrap", margin: "8px 0" }}>{preview.renderedBody}</p>
          {preview.skippedNoMarketingConsent > 0 ? <NoticeBanner tone="caution" title={`${preview.skippedNoMarketingConsent} skipped`}>They have not agreed to marketing emails.</NoticeBanner> : null}
          <Button variant="primary" iconName={needsStepUp ? "shield24" : undefined} disabled={preview.recipientCount === 0} onClick={() => setIsConfirmOpen(true)}>Send through SES</Button>
        </Card>
      ) : null}
      <SectionHeading>Recent sends</SectionHeading>
      <DataTable caption="Email sends" columns={sendColumns} rows={sends.data?.items ?? []} readRowKey={(item) => item.id} isLoading={sends.isLoading} emptyMessage="Nothing sent yet." />
      <SectionHeading>Failed notification emails</SectionHeading>
      <DataTable caption="Failed notification emails" columns={failedDeliveryColumns} rows={failedDeliveries.data?.deliveries ?? []} readRowKey={(item) => item.id} isLoading={failedDeliveries.isLoading} emptyMessage="No exhausted notification deliveries." />
      {isConfirmOpen && preview ? <ConfirmActionDialog intent="send" isOpen title="Send this email" consequences={[`${preview.recipientCount} recipient${preview.recipientCount === 1 ? "" : "s"} through AWS SES.`, "The send, audience and counts are written to the audit log."]} confirmLabel="Send email" requiresStepUp={needsStepUp} isBusy={sendMutation.isRunning} errorMessage={sendMutation.errorMessage} onConfirm={confirmSend} onClose={() => { sendMutation.clearError(); setIsConfirmOpen(false); }} /> : null}
    </>
  );
}
