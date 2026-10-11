import type { Message, Prisma } from "../../../generated/prisma/client.js";
import type { Db } from "../../../types/database.type.js";

export type MessageRow = Message;

export const messageRepository = {
  create: (db: Db, data: Prisma.MessageUncheckedCreateInput) => db.message.create({ data }),

  findById: (db: Db, id: string): Promise<MessageRow | null> => db.message.findUnique({ where: { id } }),

  findByClientId: (db: Db, conversationId: string, senderId: string, clientMessageId: string): Promise<MessageRow | null> =>
    db.message.findFirst({ where: { conversationId, senderId, clientMessageId } }),

  pageNewestFirst: (db: Db, conversationId: string, now: Date, limit: number, cursor: string | undefined): Promise<MessageRow[]> =>
    db.message.findMany({
      where: { conversationId, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      orderBy: { id: "desc" },
      take: limit + 1,
      ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
    }),

  listAfter: (db: Db, conversationId: string, now: Date, afterId: string): Promise<MessageRow[]> =>
    db.message.findMany({
      where: { conversationId, id: { gt: afterId }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      orderBy: { id: "asc" },
      take: 100,
    }),

  update: (db: Db, id: string, data: Prisma.MessageUncheckedUpdateInput) => db.message.update({ where: { id }, data }),

  findExpiredMedia: (db: Db, now: Date, take: number) =>
    db.message.findMany({ where: { mediaExpiresAt: { lte: now }, mediaPurgedAt: null }, select: { id: true, mediaId: true, conversationId: true }, orderBy: { id: "asc" }, take }),
  markMediaPurged: (db: Db, ids: readonly string[], at: Date) => db.message.updateMany({ where: { id: { in: [...ids] } }, data: { mediaPurgedAt: at, mediaUrl: null } }),
  deleteDisappeared: (db: Db, now: Date) => db.message.deleteMany({ where: { expiresAt: { lte: now } } }),
};
