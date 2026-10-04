import { reopenWindowDays } from "../../../constants/support.constant.js";
import type { DomainEventInput } from "../../../events/outbox.event.js";
import type { TicketRecord } from "../../../types/ticket.type.js";
import { firstResponseHours } from "./ticketSla.service.js";

export const ticketReference = (ticket: Pick<TicketRecord, "number">) => `SUP-${ticket.number}`;

const base = (ticket: TicketRecord) => ({ ticketId: ticket.id, reference: ticketReference(ticket), accountId: ticket.requesterAccountId, subject: ticket.subject, category: ticket.category, channel: ticket.channel });

export function ticketCreatedEvent(ticket: TicketRecord, now: Date): DomainEventInput {
  return { eventType: "ticket.created", subject: ticket.id, occurredAt: now, data: { ...base(ticket), priority: ticket.priority, firstResponseHours: firstResponseHours(ticket.priority) } };
}

export function ticketRepliedEvent(ticket: TicketRecord, reply: { readonly authorKind: "customer" | "agent"; readonly authorName: string; readonly body: string; readonly messageId?: string }, now: Date): DomainEventInput {
  return {
    eventType: "ticket.replied",
    subject: ticket.id,
    occurredAt: now,
    data: { ...base(ticket), authorKind: reply.authorKind, ...(reply.authorKind === "agent" ? { agentName: reply.authorName, message: reply.body.slice(0, 4000) } : {}), repliedAt: now.toISOString(), status: ticket.status },
  };
}

export function ticketResolvedEvent(ticket: TicketRecord, resolution: string, now: Date): DomainEventInput {
  return { eventType: "ticket.resolved", subject: ticket.id, occurredAt: now, data: { ...base(ticket), resolution: resolution.slice(0, 1000), reopenDays: reopenWindowDays, resolvedAt: now.toISOString() } };
}
