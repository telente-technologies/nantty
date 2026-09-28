import { isUniqueConstraintViolation } from "../../../databases/prisma.database.js";
import type { Conversation, Message } from "../../../generated/prisma/client.js";
import { prisma } from "../../../integrations/database.integration.js";
import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { buildPageFromFetchedRows, buildPrismaPageArguments, mapPageItems } from "../../../utils/pagination.util.js";
import type { ConversationRecord, MessageMediaItem, MessageRecord, NewMessage, ParticipantRecord } from "../models/messages.model.js";
import type { MessagesRepository } from "./messages.repository.js";

function convertConversationRowToRecord(row: Conversation, participantIds: readonly string[]): ConversationRecord {
  return { id: row.id, kind: "direct", pairKey: row.pairKey ?? "", participantIds, lastMessageAt: row.lastMessageAt, createdAt: row.createdAt };
}

function convertMessageRowToRecord(row: Message): MessageRecord {
  return { ...row, media: (Array.isArray(row.media) ? row.media : []) as unknown as MessageMediaItem[] };
}

export class PrismaMessagesRepository implements MessagesRepository {
  public async findOrCreateDirectConversation(pairKey: string, participantIds: readonly string[], now: Date): Promise<ConversationRecord> {
    const existing = await prisma().conversation.findUnique({ where: { pairKey } });
    if (existing !== null) return convertConversationRowToRecord(existing, participantIds);
    try {
      const created = await prisma().$transaction(async (tx) => {
        const conversation = await tx.conversation.create({ data: { kind: "direct", pairKey, lastMessageAt: now, createdAt: now } });
        await tx.conversationParticipant.createMany({ data: participantIds.map((userId) => ({ conversationId: conversation.id, userId, lastReadAt: now })) });
        return conversation;
      });
      return convertConversationRowToRecord(created, participantIds);
    } catch (error) {
      if (!isUniqueConstraintViolation(error)) throw error;
      const winner = await prisma().conversation.findUniqueOrThrow({ where: { pairKey } });
      return convertConversationRowToRecord(winner, participantIds);
    }
  }

  public async findConversationById(conversationId: string): Promise<ConversationRecord | undefined> {
    const row = await prisma().conversation.findUnique({ where: { id: conversationId } });
    if (row === null) return undefined;
    const participants = await prisma().conversationParticipant.findMany({ where: { conversationId } });
    return convertConversationRowToRecord(row, participants.map((participant) => participant.userId));
  }

  public async listConversationsForUser(userId: string): Promise<readonly ConversationRecord[]> {
    const memberships = await prisma().conversationParticipant.findMany({ where: { userId }, select: { conversationId: true } });
    const conversationIds = memberships.map((membership) => membership.conversationId);
    const [rows, participants] = await Promise.all([
      prisma().conversation.findMany({ where: { id: { in: conversationIds } }, orderBy: { lastMessageAt: "desc" }, take: 200 }),
      prisma().conversationParticipant.findMany({ where: { conversationId: { in: conversationIds } } }),
    ]);
    return rows.map((row) =>
      convertConversationRowToRecord(row, participants.filter((participant) => participant.conversationId === row.id).map((participant) => participant.userId)),
    );
  }

  public async findParticipant(conversationId: string, userId: string): Promise<ParticipantRecord | undefined> {
    return (await prisma().conversationParticipant.findUnique({ where: { conversationId_userId: { conversationId, userId } } })) ?? undefined;
  }

  public async appendMessage(message: NewMessage, createdAt: Date): Promise<MessageRecord> {
    const [row] = await prisma().$transaction([
      prisma().message.create({ data: { ...message, media: message.media.map((item) => ({ ...item })), createdAt } }),
      prisma().conversation.update({ where: { id: message.conversationId }, data: { lastMessageAt: createdAt } }),
      prisma().conversationParticipant.updateMany({
        where: { conversationId: message.conversationId, userId: message.senderId },
        data: { lastReadAt: createdAt },
      }),
    ]);
    return convertMessageRowToRecord(row);
  }

  public async listMessages(conversationId: string, page: PageRequest): Promise<Page<MessageRecord>> {
    const rows = await prisma().message.findMany({
      where: { conversationId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...buildPrismaPageArguments(page),
    });
    return mapPageItems(buildPageFromFetchedRows(rows, page), convertMessageRowToRecord);
  }

  public async findLatestMessage(conversationId: string): Promise<MessageRecord | undefined> {
    const row = await prisma().message.findFirst({ where: { conversationId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
    return row === null ? undefined : convertMessageRowToRecord(row);
  }

  public countUnreadMessages(conversationId: string, userId: string, since: Date): Promise<number> {
    return prisma().message.count({ where: { conversationId, senderId: { not: userId }, createdAt: { gt: since } } });
  }

  public async markConversationRead(conversationId: string, userId: string, readAt: Date): Promise<void> {
    await prisma().conversationParticipant.updateMany({ where: { conversationId, userId, lastReadAt: { lt: readAt } }, data: { lastReadAt: readAt } });
  }

  public async searchMessagesInConversations(conversationIds: readonly string[], term: string, limit: number): Promise<readonly MessageRecord[]> {
    const rows = await prisma().message.findMany({
      where: { conversationId: { in: [...conversationIds] }, text: { contains: term, mode: "insensitive" } },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.map(convertMessageRowToRecord);
  }
}
