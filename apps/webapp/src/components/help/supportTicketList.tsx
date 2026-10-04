"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { supportService } from "@/services/support.service";

import styles from "./help.module.css";
import { formatTicketDate, ticketStatusLabels } from "./ticketStatus.util";

export const supportTicketsQueryKey = ["support", "tickets"] as const;

export function SupportTicketList() {
  const tickets = useQuery({ queryKey: supportTicketsQueryKey, queryFn: supportService.listMyTickets });
  if (tickets.isLoading) return <p className={styles.muted} aria-live="polite">Loading your requests…</p>;
  if (tickets.isError) return <p className={styles.error} role="alert">{readErrorMessageForDisplay(tickets.error)}</p>;
  if ((tickets.data ?? []).length === 0) return <p className={styles.muted}>You haven't contacted support yet.</p>;
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
