"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { useAdminPermissions } from "@/components/session/adminSessionProvider";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { ErrorBlock } from "@/components/ui/feedback";
import { SelectField, TextField } from "@/components/ui/formFields";
import { PageHeader } from "@/components/ui/pageHeader";
import { Pagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Toolbar } from "@/components/ui/surfaces";
import { SegmentedTabs } from "@/components/ui/tabs";
import { UserIdentity } from "@/components/ui/userIdentity";
import { supportAssigneeTabs, supportCategoryOptions, supportPriorityOptions, supportStatusOptions } from "@/constants/supportOptions.constant";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchSupportTickets } from "@/services/supportApi.service";
import type { SupportAssigneeFilter, SupportTicketSummary } from "@/types/support.type";
import { formatRelativeTimeFromNow, humanizeConstantName } from "@/utils/formatting.util";

import { MacrosManagerDialog } from "./macrosManagerDialog";
import { SlaTimer } from "./slaTimer";
import styles from "./ticketsWorkspace.module.css";

function readNextSlaTimer(ticket: SupportTicketSummary) {
  if (ticket.status === "RESOLVED" || ticket.status === "CLOSED") return <span className={styles.muted}>Stopped</span>;
  return ticket.firstRespondedAt ? <SlaTimer label="Resolve" dueAt={ticket.resolutionDueAt} metAt={null} /> : <SlaTimer label="Reply" dueAt={ticket.firstResponseDueAt} metAt={null} />;
}

const columns: DataTableColumn<SupportTicketSummary>[] = [
  {
    key: "subject",
    header: "Ticket",
    render: (ticket) => (
      <span className={styles.subjectCell}>
        <strong>{ticket.subject}</strong>
        <span className={styles.muted}>
          <code>{ticket.reference}</code>{ticket.channel === "CHAT" ? " · Live chat" : ""} · {ticket.lastMessagePreview}
        </span>
      </span>
    ),
  },
  { key: "requester", header: "Requester", render: (ticket) => <UserIdentity user={ticket.requester} size={24} /> },
  { key: "category", header: "Category", render: (ticket) => humanizeConstantName(ticket.category) },
  { key: "priority", header: "Priority", render: (ticket) => <StatusBadge status={ticket.priority} /> },
  { key: "status", header: "Status", render: (ticket) => <StatusBadge status={ticket.status} /> },
  { key: "assignee", header: "Assignee", render: (ticket) => ticket.assignee?.name ?? <span className={styles.muted}>Unassigned</span> },
  { key: "sla", header: "SLA", render: readNextSlaTimer },
  { key: "updated", header: "Updated", render: (ticket) => <span className={styles.muted}>{formatRelativeTimeFromNow(ticket.updatedAt)}</span> },
];

export function TicketsWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { can } = useAdminPermissions();
  const [assignee, setAssignee] = useState<SupportAssigneeFilter>((searchParams.get("assignee") as SupportAssigneeFilter | null) ?? "all");
  const [status, setStatus] = useState(searchParams.get("status") ?? "OPEN,AWAITING_SUPPORT,AWAITING_USER");
  const [priority, setPriority] = useState("");
  const [category, setCategory] = useState("");
  const [searchText, setSearchText] = useState("");
  const [page, setPage] = useState(1);
  const [isMacrosOpen, setIsMacrosOpen] = useState(false);
  const filters = { assignee, status, priority, category, search: searchText.trim(), page };
  const tickets = useAdminQuery((signal) => fetchSupportTickets(filters, signal), JSON.stringify(filters));

  function updateFilter(apply: () => void) {
    apply();
    setPage(1);
  }

  return (
    <>
      <PageHeader
        area="Support"
        title="Tickets"
        description="Help requests from buyers, sellers and creators. Breached SLAs sort to the top."
        actions={<Button iconName="textIndent24" onClick={() => setIsMacrosOpen(true)}>{can("support:assign") ? "Manage macros" : "View macros"}</Button>}
      />
      <SegmentedTabs label="Assignee" items={supportAssigneeTabs} activeKey={assignee} onChange={(key) => updateFilter(() => setAssignee(key))} />
      <Toolbar>
        <TextField label="Search tickets" isLabelHidden placeholder="Ticket, order or dispute ID, or subject" value={searchText} onChange={(event) => updateFilter(() => setSearchText(event.target.value))} className={styles.search} />
        <SelectField label="Status" isLabelHidden options={supportStatusOptions} value={status} onChange={(event) => updateFilter(() => setStatus(event.target.value))} />
        <SelectField label="Priority" isLabelHidden options={supportPriorityOptions} value={priority} onChange={(event) => updateFilter(() => setPriority(event.target.value))} />
        <SelectField label="Category" isLabelHidden options={supportCategoryOptions} value={category} onChange={(event) => updateFilter(() => setCategory(event.target.value))} />
      </Toolbar>
      {tickets.errorMessage ? <ErrorBlock message={tickets.errorMessage} onRetry={tickets.reload} /> : null}
      <DataTable
        caption="Support tickets"
        columns={columns}
        rows={tickets.data?.items ?? []}
        readRowKey={(ticket) => ticket.id}
        onRowOpen={(ticket) => router.push(`/support/${encodeURIComponent(ticket.id)}`)}
        isLoading={tickets.isLoading}
        emptyMessage="No tickets match these filters. Nice work."
        readRowTone={(ticket) => (ticket.isSlaBreached ? "danger" : ticket.priority === "URGENT" ? "caution" : null)}
      />
      {tickets.data ? <Pagination page={tickets.data.page} pageSize={tickets.data.pageSize} total={tickets.data.total} onPageChange={setPage} /> : null}
      {isMacrosOpen ? <MacrosManagerDialog canManage={can("support:assign")} onClose={() => setIsMacrosOpen(false)} /> : null}
    </>
  );
}
