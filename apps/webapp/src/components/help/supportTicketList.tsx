"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { ChatIcon } from "@/components/ui/icons";
import { ListRowsSkeleton } from "@/components/ui/pageSkeletons";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { supportService } from "@/services/support.service";

import styles from "./help.module.css";
import { formatTicketDate, ticketStatusLabels } from "./ticketStatus.util";

export const supportTicketsQueryKey = ["support", "tickets"] as const;

export function SupportTicketList() {
  const tickets = useQuery({ queryKey: supportTicketsQueryKey, queryFn: supportService.listMyTickets });
  if (tickets.isLoading) return <ListRowsSkeleton label="Loading your requests" rows={4} withAvatar={false} />;
  if (tickets.isError) return <ErrorState description={readErrorMessageForDisplay(tickets.error)} error={tickets.error} onRetry={() => void tickets.refetch()} />;
  if ((tickets.data ?? []).length === 0) {
    return (
      <EmptyState
        icon={<ChatIcon size={28} />}
        title="No support requests"
        description="You haven't contacted support yet. Most answers are in the Help Centre."
      />
    );
  }
  return (
    <ul className={styles.list}>
      {(tickets.data ?? []).map((ticket) => (
        <li key={ticket.id}>
          <Link href={`/help/tickets/${encodeURIComponent(ticket.id)}`} className={styles.card}>
            <span className={styles.row}>
              <span className={styles.cardTitle}>{ticket.subject}</span>
              <span className={styles.status}>{ticketStatusLabels[ticket.status]}</span>
              {(ticket.unreadCount ?? 0) > 0 ? <span className={styles.badge} aria-label={`${ticket.unreadCount} unread replies`}>{ticket.unreadCount}</span> : null}
            </span>
            <span className={styles.muted}>{ticket.lastMessagePreview}</span>
            <span className={styles.muted}>{ticket.reference ? `${ticket.reference} · ` : ""}Updated {formatTicketDate(ticket.updatedAt)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
