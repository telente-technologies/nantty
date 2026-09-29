import type { Message, Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../../integrations/database.integration.js";
import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { buildPageFromFetchedRows, buildPrismaPageArguments, mapPageItems } from "../../../utils/pagination.util.js";
import type { MessageKind, MessageMediaItem, MessageRecord, MessageSyncPosition, NewMessage, ReactionRecord } from "../models/messages.model.js";
import type { MessagesRepository } from "./messages.repository.js";

const NEWEST_FIRST = [{ createdAt: "desc" as const }, { id: "desc" as const }];

function convertMessageRow(row: Message): MessageRecord {
  return { ...row, kind: row.kind as MessageKind, media: (Array.isArray(row.media) ? row.media : []) as unknown as MessageMediaItem[] };
}

function visibleIn(conversationId: string, now: Date): Prisma.MessageWhereInput {
  return { conversationId, hiddenAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] };
}

export class PrismaMessagesRepository implements MessagesRepository {
  public async appendMessage(message: NewMessage, createdAt: Date): Promise<MessageRecord> {
    const row = await prisma().message.create({ data: { ...message, media: message.media.map((item) => ({ ...item })), createdAt } });
    return convertMessageRow(row);
  }

  public async findById(messageId: string): Promise<MessageRecord | undefined> {
    const row = await prisma().message.findUnique({ where: { id: messageId } });
    return row === null ? undefined : convertMessageRow(row);
  }

  public async listVisibleMessages(conversationId: string, now: Date, page: PageRequest): Promise<Page<MessageRecord>> {
    const rows = await prisma().message.findMany({ where: visibleIn(conversationId, now), orderBy: NEWEST_FIRST, ...buildPrismaPageArguments(page) });
    return mapPageItems(buildPageFromFetchedRows(rows, page), convertMessageRow);
  }

  public async listVisibleMessagesAfter(conversationId: string, now: Date, position: MessageSyncPosition, limit: number): Promise<readonly MessageRecord[]> {
    const rows = await prisma().message.findMany({
      where: {
        AND: [
          visibleIn(conversationId, now),
          { OR: [{ createdAt: { gt: position.createdAt } }, { createdAt: position.createdAt, id: { gt: position.messageId } }] },
        ],
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: limit,
    });
    return rows.map(convertMessageRow);
  }

  public async findLatestVisibleMessage(conversationId: string, now: Date): Promise<MessageRecord | undefined> {
    const row = await prisma().message.findFirst({ where: visibleIn(conversationId, now), orderBy: NEWEST_FIRST });
    return row === null ? undefined : convertMessageRow(row);
  }

  public countUnreadMessages(conversationId: string, userId: string, since: Date, now: Date): Promise<number> {
    return prisma().message.count({ where: { AND: [visibleIn(conversationId, now), { senderId: { not: userId }, createdAt: { gt: since } }] } });
  }

  public async searchVisibleMessages(conversationIds: readonly string[], term: string, now: Date, limit: number): Promise<readonly MessageRecord[]> {
    const rows = await prisma().message.findMany({
      where: {
        conversationId: { in: [...conversationIds] },
        hiddenAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        text: { contains: term, mode: "insensitive" },
      },
      orderBy: NEWEST_FIRST,
      take: limit,
    });
    return rows.map(convertMessageRow);
  }

  public async setHiddenAt(messageId: string, hiddenAt: Date | null): Promise<boolean> {
    const result = await prisma().message.updateMany({ where: { id: messageId }, data: { hiddenAt } });
    return result.count > 0;
  }

  public async deleteExpiredMessages(now: Date, limit: number): Promise<number> {
    const expired = await prisma().message.findMany({ where: { expiresAt: { lte: now } }, select: { id: true }, take: limit });
    const messageIds = expired.map((row) => row.id);
    if (messageIds.length === 0) return 0;
    const [, deleted] = await prisma().$transaction([
      prisma().messageReaction.deleteMany({ where: { messageId: { in: messageIds } } }),
      prisma().message.deleteMany({ where: { id: { in: messageIds } } }),
    ]);
    return deleted.count;
  }

  public async addReaction(messageId: string, userId: string, emoji: string, now: Date): Promise<void> {
    await prisma().messageReaction.upsert({
      where: { messageId_userId_emoji: { messageId, userId, emoji } },
      create: { messageId, userId, emoji, createdAt: now },
      update: {},
    });
  }

  public async removeReaction(messageId: string, userId: string, emoji: string): Promise<void> {
    await prisma().messageReaction.deleteMany({ where: { messageId, userId, emoji } });
  }

  public async listReactions(messageIds: readonly string[]): Promise<readonly ReactionRecord[]> {
    return prisma().messageReaction.findMany({ where: { messageId: { in: [...messageIds] } } });
  }
}
