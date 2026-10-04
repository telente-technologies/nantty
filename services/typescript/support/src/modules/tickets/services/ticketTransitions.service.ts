import type { DomainEventInput } from "../../../events/outbox.event.js";
import type { TicketStatus } from "../../../enums/ticket.enum.js";
import type { TicketUpdate, TicketWithThread } from "../../../types/ticket.type.js";
import { ticketResolvedEvent } from "./ticketEvents.service.js";

export function latestAgentAnswer(ticket: TicketWithThread, extraAnswer?: string): string {
  if (extraAnswer !== undefined) return extraAnswer;
  return [...ticket.messages].reverse().find((message) => message.authorKind === "agent")?.body ?? "Our support team marked your request as resolved.";
}

export function buildStatusTransition(ticket: TicketWithThread, status: TicketStatus, now: Date, extraAnswer?: string): { readonly update: TicketUpdate; readonly events: DomainEventInput[] } {
  if (status === "resolved") {
    const hasStaffAnswer = extraAnswer !== undefined || ticket.messages.some((message) => message.authorKind === "agent");
    const update: TicketUpdate = { status, resolvedAt: now, closedAt: null, ...(hasStaffAnswer && ticket.autoFaqStatus === "none" ? { autoFaqStatus: "queued" } : {}) };
    return { update, events: [ticketResolvedEvent({ ...ticket, status, updatedAt: now }, latestAgentAnswer(ticket, extraAnswer), now)] };
  }
  if (status === "closed") return { update: { status, closedAt: now, resolvedAt: ticket.resolvedAt ?? now }, events: [] };
  return { update: { status, resolvedAt: null, closedAt: null }, events: [] };
}
