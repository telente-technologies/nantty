"use client";

import Link from "next/link";
import { useState } from "react";

import { useAdminPermissions, useAdminSession } from "@/components/session/adminSessionProvider";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/feedback";
import { SelectField } from "@/components/ui/formFields";
import { Card, KeyValueList } from "@/components/ui/surfaces";
import { UserIdentity } from "@/components/ui/userIdentity";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { assignSupportTicket, changeSupportTicketStatus, fetchSupportAgents } from "@/services/supportApi.service";
import type { SupportTicketDetail, SupportTicketStatus, SupportTicketSummary } from "@/types/support.type";
import { formatDateTime, humanizeConstantName } from "@/utils/formatting.util";

import { SlaTimer } from "./slaTimer";
import styles from "./ticketDetailWorkspace.module.css";

type TicketChangeHandler = (detail: SupportTicketDetail, message: string) => void;

export function TicketRequesterCard({ ticket }: { readonly ticket: SupportTicketSummary }) {
  const { can } = useAdminPermissions();
  return (
    <Card title="Requester">
      <div className={styles.cardStack}>
        <UserIdentity user={ticket.requester} size={36} />
        <KeyValueList
          items={[
            { label: "Country", value: `${ticket.requester.country} · ${ticket.requester.currency}` },
            { label: "Email", value: ticket.requester.emailMasked, isMono: true },
            { label: "Account", value: humanizeConstantName(ticket.requester.status) },
          ]}
        />
        {can("users:read") ? <Link href={`/users/${encodeURIComponent(ticket.requester.id)}`}>Open user profile</Link> : null}
      </div>
    </Card>
  );
}

export function TicketFactsCard({ ticket }: { readonly ticket: SupportTicketSummary }) {
  const isStopped = ticket.status === "RESOLVED" || ticket.status === "CLOSED";
  return (
    <Card title="Ticket">
      <KeyValueList
        columns={2}
        items={[
          { label: "Category", value: humanizeConstantName(ticket.category) },
          { label: "Priority", value: humanizeConstantName(ticket.priority) },
          { label: "Opened", value: formatDateTime(ticket.createdAt) },
          { label: "Resolved", value: formatDateTime(ticket.resolvedAt) },
          { label: "First reply", value: <SlaTimer label="Reply" dueAt={ticket.firstResponseDueAt} metAt={ticket.firstRespondedAt} isStopped={isStopped} /> },
          { label: "Resolution", value: <SlaTimer label="Resolve" dueAt={ticket.resolutionDueAt} metAt={ticket.resolvedAt} isStopped={false} /> },
          { label: "Channel", value: ticket.channel === "CHAT" ? "Live chat" : "Ticket form" },
          { label: "Rating", value: ticket.satisfactionScore === null ? "—" : `${ticket.satisfactionScore} of 5` },
          { label: "Help topic", value: humanizeConstantName(ticket.autoFaqStatus) },
          { label: "Order", value: ticket.linkedOrderId ? <Link href={`/commerce/orders/${encodeURIComponent(ticket.linkedOrderId)}`}>{ticket.linkedOrderId}</Link> : "—", isMono: true },
          { label: "Dispute", value: ticket.linkedDisputeId ? <Link href={`/commerce/disputes/${encodeURIComponent(ticket.linkedDisputeId)}`}>{ticket.linkedDisputeId}</Link> : "—", isMono: true },
        ]}
      />
    </Card>
  );
}

export function TicketAssignmentCard({ ticket, onChanged }: { readonly ticket: SupportTicketSummary; readonly onChanged: TicketChangeHandler }) {
  const { admin } = useAdminSession();
  const { can } = useAdminPermissions();
  const canAssignOthers = can("support:assign");
  const [assigneeId, setAssigneeId] = useState(ticket.assignee?.id ?? "");
  const agents = useAdminQuery((signal) => fetchSupportAgents(signal), "support-agents", canAssignOthers);
  const assignMutation = useAdminMutation((targetAssigneeId: string | null) => assignSupportTicket(ticket.id, targetAssigneeId));

  async function assignTo(targetAssigneeId: string | null) {
    const detail = await assignMutation.run(targetAssigneeId);
    if (!detail) return;
    setAssigneeId(detail.ticket.assignee?.id ?? "");
    onChanged(detail, detail.ticket.assignee ? `Assigned to ${detail.ticket.assignee.name}` : "Ticket unassigned");
  }

  const agentOptions = [{ value: "", label: "Unassigned" }, ...(agents.data?.items ?? []).map((agent) => ({ value: agent.id, label: agent.id === admin.id ? `${agent.name} (you)` : agent.name }))];
  return (
    <Card title="Assignment">
      <div className={styles.cardStack}>
        <p>{ticket.assignee ? <>Assigned to <strong>{ticket.assignee.name}</strong></> : "Nobody owns this ticket yet."}</p>
        {canAssignOthers ? (
          <div className={styles.inlineControls}>
            <SelectField label="Assignee" isLabelHidden options={agentOptions} value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} />
            <Button onClick={() => void assignTo(assigneeId || null)} isBusy={assignMutation.isRunning} disabled={assigneeId === (ticket.assignee?.id ?? "")}>
              Assign
            </Button>
          </div>
        ) : null}
        {ticket.assignee?.id !== admin.id ? (
          <Button variant="secondary" onClick={() => void assignTo(admin.id)} isBusy={assignMutation.isRunning}>
            Assign to me
          </Button>
        ) : null}
        {assignMutation.errorMessage ? <InlineError message={assignMutation.errorMessage} /> : null}
      </div>
    </Card>
  );
}

const statusOptions: { value: SupportTicketStatus; label: string }[] = [
  { value: "OPEN", label: "Open" },
  { value: "AWAITING_SUPPORT", label: "Waiting for support" },
  { value: "AWAITING_USER", label: "Waiting for customer" },
  { value: "RESOLVED", label: "Resolved (may become a help topic)" },
  { value: "CLOSED", label: "Closed (no more replies)" },
];

export function TicketStatusCard({ ticket, onChanged }: { readonly ticket: SupportTicketSummary; readonly onChanged: TicketChangeHandler }) {
  const [status, setStatus] = useState<SupportTicketStatus>(ticket.status);
  const statusMutation = useAdminMutation((nextStatus: SupportTicketStatus) => changeSupportTicketStatus(ticket.id, nextStatus));

  async function saveStatus() {
    const detail = await statusMutation.run(status);
    if (detail) onChanged(detail, `Ticket marked ${humanizeConstantName(detail.ticket.status).toLowerCase()}`);
  }

  return (
    <Card title="Status">
      <div className={styles.cardStack}>
        <div className={styles.inlineControls}>
          <SelectField label="Status" isLabelHidden options={statusOptions} value={status} onChange={(event) => setStatus(event.target.value as SupportTicketStatus)} />
          <Button onClick={() => void saveStatus()} isBusy={statusMutation.isRunning} disabled={status === ticket.status}>
            Update
          </Button>
        </div>
        {statusMutation.errorMessage ? <InlineError message={statusMutation.errorMessage} /> : null}
      </div>
    </Card>
  );
}
