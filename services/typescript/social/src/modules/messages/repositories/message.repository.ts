import type { Prisma } from "../../../generated/prisma/client.js";
import type { Db } from "../../../types/database.type.js";

export const messageInclude = (viewerId: string) => ({
  reactions: true,
  pollOptions: { orderBy: { position: "asc" }, include: { _count: { select: { votes: true } }, votes: { where: { userId: viewerId }, select: { userId: true } } } },
}) satisfies Prisma.MessageInclude;

export type MessageRow = Prisma.MessageGetPayload<{ include: ReturnType<typeof messageInclude> }>;

export const messageRepository = {
  create: (db: Db, data: Prisma.MessageUncheckedCreateInput, pollOptions: readonly string[]) =>
    db.message.create({ data: { ...data, ...(pollOptions.length === 0 ? {} : { pollOptions: { create: pollOptions.map((text, position) => ({ text, position })) } }) } }),

  findById: (db: Db, id: string, viewerId: string): Promise<MessageRow | null> => db.message.findUnique({ where: { id }, include: messageInclude(viewerId) }),

  findByClientId: (db: Db, conversationId: string, senderId: string, clientMessageId: string): Promise<MessageRow | null> =>
    db.message.findFirst({ where: { conversationId, senderId, clientMessageId }, include: messageInclude(senderId) }),

  pageNewestFirst: (db: Db, conversationId: string, viewerId: string, now: Date, limit: number, cursor: string | undefined): Promise<MessageRow[]> =>
    db.message.findMany({
      where: { conversationId, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      orderBy: { id: "desc" },
      take: limit + 1,
      include: messageInclude(viewerId),
      ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
    }),

  listAfter: (db: Db, conversationId: string, viewerId: string, now: Date, afterId: string): Promise<MessageRow[]> =>
    db.message.findMany({
      where: { conversationId, id: { gt: afterId }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      orderBy: { id: "asc" },
      take: 100,
      include: messageInclude(viewerId),
    }),

  update: (db: Db, id: string, data: Prisma.MessageUncheckedUpdateInput) => db.message.update({ where: { id }, data }),

  addReaction: (db: Db, messageId: string, userId: string, emoji: string) => db.messageReaction.createMany({ data: [{ messageId, userId, emoji }], skipDuplicates: true }),
  removeReaction: (db: Db, messageId: string, userId: string, emoji: string) => db.messageReaction.deleteMany({ where: { messageId, userId, emoji } }),

  findOption: (db: Db, messageId: string, optionId: string) => db.messagePollOption.findFirst({ where: { id: optionId, messageId } }),
  findVote: (db: Db, optionId: string, userId: string) => db.messagePollVote.findUnique({ where: { optionId_userId: { optionId, userId } } }),
  addVote: (db: Db, optionId: string, messageId: string, userId: string) => db.messagePollVote.create({ data: { optionId, messageId, userId } }),
  removeVote: (db: Db, optionId: string, userId: string) => db.messagePollVote.deleteMany({ where: { optionId, userId } }),
  removeVotesForMessage: (db: Db, messageId: string, userId: string) => db.messagePollVote.deleteMany({ where: { messageId, userId } }),

  findExpiredMedia: (db: Db, now: Date, take: number) =>
    db.message.findMany({ where: { mediaExpiresAt: { lte: now }, mediaPurgedAt: null }, select: { id: true, mediaId: true, conversationId: true }, orderBy: { id: "asc" }, take }),
  markMediaPurged: (db: Db, ids: readonly string[], at: Date) => db.message.updateMany({ where: { id: { in: [...ids] } }, data: { mediaPurgedAt: at, mediaUrl: null } }),
  deleteDisappeared: (db: Db, now: Date) => db.message.deleteMany({ where: { expiresAt: { lte: now } } }),
  countSharesOfReference: (db: Db, kind: string, id: string) =>
    db.message.count({ where: { kind: "shared", sharedContent: { equals: { kind, id } } } }),
};
