import type { Prisma } from "../../../generated/prisma/client.js";
import type { AutoFaqStatus, LinkedReferenceKind, MessageAuthorKind, TicketCategory, TicketChannel, TicketPriority, TicketStatus } from "../../../enums/ticket.enum.js";
import type { TicketAttachment, TicketHistoryRecord, TicketMessageRecord, TicketRecord, TicketWithThread } from "../../../types/ticket.type.js";

export type TicketRow = Prisma.SupportTicketGetPayload<object>;
export type TicketRowWithThread = Prisma.SupportTicketGetPayload<{ include: { messages: true; history: true } }>;

export const threadInclude = { messages: { orderBy: { createdAt: "asc" } }, history: { orderBy: { createdAt: "asc" } } } as const;

function readAttachments(value: unknown): TicketAttachment[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const record = entry as Record<string, unknown>;
    return typeof record["url"] === "string" ? [{ url: record["url"], contentType: typeof record["contentType"] === "string" ? record["contentType"] : null }] : [];
  });
}

export function mapTicketRow(row: TicketRow): TicketRecord {
  return {
    id: row.id,
    number: row.number,
    requesterAccountId: row.requesterAccountId,
    requesterName: row.requesterName,
    requesterUsername: row.requesterUsername,
    subject: row.subject,
    category: row.category as TicketCategory,
    priority: row.priority as TicketPriority,
    status: row.status as TicketStatus,
    channel: row.channel as TicketChannel,
    linkedReference: row.linkedKind !== null && row.linkedId !== null ? { kind: row.linkedKind as LinkedReferenceKind, id: row.linkedId, label: row.linkedLabel ?? row.linkedId } : null,
    assigneeStaffId: row.assigneeStaffId,
    assigneeName: row.assigneeName,
    firstResponseDueAt: row.firstResponseDueAt,
    firstRespondedAt: row.firstRespondedAt,
    resolutionDueAt: row.resolutionDueAt,
    resolvedAt: row.resolvedAt,
    closedAt: row.closedAt,
    satisfactionScore: row.satisfactionScore,
    satisfactionComment: row.satisfactionComment,
    lastMessageAt: row.lastMessageAt,
    lastMessagePreview: row.lastMessagePreview,
    requesterUnread: row.requesterUnread,
    messageCount: row.messageCount,
    autoFaqStatus: row.autoFaqStatus as AutoFaqStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapTicketRowWithThread(row: TicketRowWithThread): TicketWithThread {
  const messages: TicketMessageRecord[] = row.messages.map((message) => ({
    id: message.id, ticketId: message.ticketId, authorKind: message.authorKind as MessageAuthorKind, authorId: message.authorId, authorName: message.authorName,
    body: message.body, attachments: readAttachments(message.attachments), createdAt: message.createdAt,
  }));
  const history: TicketHistoryRecord[] = row.history.map((entry) => ({
    id: entry.id, action: entry.action, actorId: entry.actorId, actorName: entry.actorName, reason: entry.reason,
    detail: (entry.detail ?? {}) as Record<string, unknown>, createdAt: entry.createdAt,
  }));
  return { ...mapTicketRow(row), messages, history };
}
