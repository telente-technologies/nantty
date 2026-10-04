import type { RequesterProfile } from "../../../interfaces/identityDirectory.interface.js";
import { isTicketStatusStopped, type TicketStatus } from "../../../enums/ticket.enum.js";
import type { TicketHistoryRecord, TicketMessageRecord, TicketRecord, TicketWithThread } from "../../../types/ticket.type.js";
import { isTicketBreachingSla } from "./ticketSla.service.js";
import { ticketReference } from "./ticketEvents.service.js";

const userStatus: Readonly<Record<TicketStatus, string>> = { open: "open", awaiting_user: "awaiting_you", awaiting_support: "awaiting_support", resolved: "resolved", closed: "closed" };
const iso = (date: Date | null) => (date === null ? null : date.toISOString());

export function presentTicketForRequester(ticket: TicketRecord) {
  return {
    id: ticket.id,
    reference: ticketReference(ticket),
    subject: ticket.subject,
    category: ticket.category,
    status: userStatus[ticket.status],
    channel: ticket.channel,
    linkedReference: ticket.linkedReference,
    lastMessagePreview: ticket.lastMessagePreview,
    unreadCount: ticket.requesterUnread,
    satisfactionScore: ticket.satisfactionScore,
    canRate: isTicketStatusStopped(ticket.status) && ticket.satisfactionScore === null,
    canReply: ticket.status !== "closed",
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
  };
}

function presentRequesterMessage(message: TicketMessageRecord) {
  return {
    id: message.id,
    fromSupport: message.authorKind !== "customer",
    authorName: message.authorKind === "customer" ? message.authorName : message.authorKind === "system" ? "Zudomart" : message.authorName,
    text: message.body,
    attachmentUrls: message.attachments.map((attachment) => attachment.url),
    createdAt: message.createdAt.toISOString(),
  };
}

export function presentTicketThreadForRequester(ticket: TicketWithThread) {
  return { ...presentTicketForRequester(ticket), messages: ticket.messages.filter((message) => message.authorKind !== "internal_note").map(presentRequesterMessage), agentTyping: false, isRecorded: true, isEndToEndEncrypted: false };
}

export function presentRequesterSummaryForStaff(ticket: TicketRecord, profile: RequesterProfile | null) {
  return {
    id: ticket.requesterAccountId,
    username: profile?.username || ticket.requesterUsername,
    displayName: profile?.displayName || ticket.requesterName,
    avatarUrl: null,
    country: "",
    currency: "",
    status: (profile?.status ?? "active").toUpperCase(),
    verification: null,
    isSeller: false,
    isCreator: false,
    followerCount: 0,
    joinedAt: ticket.createdAt.toISOString(),
    lastActiveAt: ticket.lastMessageAt.toISOString(),
    strikeCount: 0,
    riskLevel: "LOW",
    emailMasked: profile?.emailMasked ?? "",
    phoneMasked: "",
  };
}

export function presentTicketForStaff(ticket: TicketRecord, now: Date, profile: RequesterProfile | null = null) {
  return {
    id: ticket.id,
    reference: ticketReference(ticket),
    subject: ticket.subject,
    category: ticket.category.toUpperCase(),
    priority: ticket.priority.toUpperCase(),
    status: ticket.status.toUpperCase(),
    channel: ticket.channel.toUpperCase(),
    requester: presentRequesterSummaryForStaff(ticket, profile),
    assignee: ticket.assigneeStaffId === null ? null : { id: ticket.assigneeStaffId, name: ticket.assigneeName ?? "Agent", email: "" },
    linkedReference: ticket.linkedReference,
    linkedOrderId: ticket.linkedReference?.kind === "order" || ticket.linkedReference?.kind === "payment" ? ticket.linkedReference.id : null,
    linkedDisputeId: ticket.linkedReference?.kind === "dispute" ? ticket.linkedReference.id : null,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    firstResponseDueAt: ticket.firstResponseDueAt.toISOString(),
    firstRespondedAt: iso(ticket.firstRespondedAt),
    resolutionDueAt: ticket.resolutionDueAt.toISOString(),
    resolvedAt: iso(ticket.resolvedAt),
    closedAt: iso(ticket.closedAt),
    satisfactionScore: ticket.satisfactionScore,
    satisfactionComment: ticket.satisfactionComment,
    autoFaqStatus: ticket.autoFaqStatus.toUpperCase(),
    lastMessagePreview: ticket.lastMessagePreview,
    messageCount: ticket.messageCount,
    isSlaBreached: isTicketBreachingSla(ticket, now),
  };
}

function presentHistoryEntry(ticket: TicketRecord, entry: TicketHistoryRecord) {
  const isCustomer = entry.actorId === ticket.requesterAccountId;
  return {
    id: entry.id,
    occurredAt: entry.createdAt.toISOString(),
    actor: { id: entry.actorId, name: entry.actorName, kind: entry.actorId === "system" ? "SYSTEM" : isCustomer ? "USER" : "ADMIN", role: null },
    action: entry.action,
    area: "support",
    target: { type: "supportTicket", id: ticket.id, label: ticketReference(ticket) },
    reason: entry.reason,
    before: null,
    after: entry.detail,
    ipAddress: null,
    requestId: entry.id,
    stepUpVerified: false,
  };
}

export function presentTicketDetailForStaff(ticket: TicketWithThread, now: Date, profile: RequesterProfile | null) {
  return {
    ticket: presentTicketForStaff(ticket, now, profile),
    messages: ticket.messages.map((message) => ({
      id: message.id,
      authorKind: message.authorKind.toUpperCase(),
      authorName: message.authorName,
      body: message.body,
      attachmentUrls: message.attachments.map((attachment) => attachment.url),
      createdAt: message.createdAt.toISOString(),
    })),
    history: ticket.history.map((entry) => presentHistoryEntry(ticket, entry)),
    isRecorded: true,
    isEndToEndEncrypted: false,
  };
}
