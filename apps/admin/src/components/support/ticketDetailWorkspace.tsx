"use client";

import Link from "next/link";

import { AuditHistoryList } from "@/components/audit/auditHistoryList";
import { ErrorBlock, LoadingBlock } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/pageHeader";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Card, TwoColumnLayout } from "@/components/ui/surfaces";
import { useToast } from "@/components/ui/toastProvider";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchSupportTicketDetail } from "@/services/supportApi.service";
import type { SupportTicketDetail } from "@/types/support.type";
import { humanizeConstantName } from "@/utils/formatting.util";

import { TicketConversation } from "./ticketConversation";
import styles from "./ticketDetailWorkspace.module.css";
import { TicketReplyBox } from "./ticketReplyBox";
import { TicketAssignmentCard, TicketFactsCard, TicketRequesterCard, TicketStatusCard } from "./ticketSidebarCards";
import { IconLabel } from "@/components/ui/zudoIcon";

export function TicketDetailWorkspace({ ticketId }: { readonly ticketId: string }) {
  const { showToast } = useToast();
  const { data, errorMessage, isLoading, reload, replaceData } = useAdminQuery((signal) => fetchSupportTicketDetail(ticketId, signal), ticketId);

  function applyTicketChange(detail: SupportTicketDetail, message: string) {
    replaceData(() => detail);
    showToast(message);
  }

  if (errorMessage) return <ErrorBlock variant="section" message={errorMessage} onRetry={reload} />;
  if (isLoading || !data) return <LoadingBlock lines={8} label="Loading ticket" />;
  const { ticket } = data;
  return (
    <>
      <Link href="/support" className={styles.backLink}>
        <IconLabel name="arrowLeft24" size={16}>All tickets</IconLabel>
      </Link>
      <PageHeader
        area={`Support · ${ticket.id}`}
        title={ticket.subject}
        meta={
          <>
            <StatusBadge status={ticket.status} />
            <StatusBadge status={ticket.priority} label={`${humanizeConstantName(ticket.priority)} priority`} />
            {ticket.isSlaBreached ? <StatusBadge label="SLA breached" tone="danger" /> : null}
          </>
        }
      />
      <TwoColumnLayout
        main={
          <>
            <Card title="Conversation">
              <TicketConversation messages={data.messages} />
            </Card>
            <TicketReplyBox key={`${ticket.id}:${ticket.status}`} ticket={ticket} onSent={applyTicketChange} />
          </>
        }
        aside={
          <>
            <TicketRequesterCard ticket={ticket} />
            <TicketFactsCard ticket={ticket} />
            <TicketAssignmentCard key={`assign:${ticket.assignee?.id ?? "none"}`} ticket={ticket} onChanged={applyTicketChange} />
            <TicketStatusCard key={`status:${ticket.status}`} ticket={ticket} onChanged={applyTicketChange} />
            <Card title="History">
              <AuditHistoryList entries={data.history} emptyMessage="No admin actions on this ticket yet." />
            </Card>
          </>
        }
      />
    </>
  );
}
