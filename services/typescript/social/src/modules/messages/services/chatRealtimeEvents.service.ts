import { socialEventTypes } from "../../../events/eventTypes.event.js";
import type { DomainEventInput } from "../../../events/outbox.event.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import type { Db } from "../../../types/database.type.js";
import type { MessageRow } from "../repositories/message.repository.js";

export async function activeMemberIds(db: Db, conversationId: string): Promise<string[]> {
  const rows = await db.conversationMember.findMany({ where: { conversationId, leftAt: null }, select: { accountId: true } });
  return rows.map((row) => row.accountId);
}

export function realtimeMessageEnvelope(row: MessageRow): Prisma.InputJsonObject {
  const hidden = row.hiddenAt !== null;
  return {
    id: row.id, conversationId: row.conversationId, senderId: row.senderId, kind: row.kind, createdAt: row.createdAt.toISOString(),
    encryption: hidden ? null : { deviceId: row.deviceId, ciphertext: row.ciphertext, protocol: row.protocol },
    moderationHidden: hidden,
  };
}

export function messageUpdatedEvent(row: MessageRow, memberIds: readonly string[], occurredAt: Date): DomainEventInput {
  return { eventType: socialEventTypes.messageUpdated, subject: row.conversationId, occurredAt, data: { conversationId: row.conversationId, messageId: row.id, message: realtimeMessageEnvelope(row), memberIds: [...memberIds] } };
}

export function messageRemovedEvent(conversationId: string, messageId: string, reason: "moderation" | "deleted" | "expired", memberIds: readonly string[], occurredAt: Date): DomainEventInput {
  return { eventType: socialEventTypes.messageRemoved, subject: conversationId, occurredAt, data: { conversationId, messageId, reason, memberIds: [...memberIds] } };
}

export function conversationReadEvent(conversationId: string, readerId: string, readAt: Date, memberIds: readonly string[]): DomainEventInput {
  return { eventType: socialEventTypes.conversationRead, subject: conversationId, occurredAt: readAt, data: { conversationId, readerId, lastReadAt: readAt.toISOString(), memberIds: [...memberIds] } };
}

export function conversationUpdatedEvent(conversationId: string, changes: Prisma.InputJsonObject, occurredAt: Date, audience: { readonly accountId: string } | { readonly memberIds: readonly string[] }): DomainEventInput {
  return {
    eventType: socialEventTypes.conversationUpdated, subject: conversationId, occurredAt,
    data: { conversationId, changes, ...("accountId" in audience ? { accountId: audience.accountId } : { memberIds: [...audience.memberIds] }) },
  };
}

export function membershipEndedEvent(conversationId: string, accountId: string, reason: "removed" | "left", occurredAt: Date, actorId?: string): DomainEventInput {
  return {
    eventType: reason === "removed" ? socialEventTypes.conversationMemberRemoved : socialEventTypes.conversationMemberLeft, subject: conversationId, occurredAt,
    data: { conversationId, accountId, ...(actorId === undefined ? {} : { removedBy: actorId }) },
  };
}
