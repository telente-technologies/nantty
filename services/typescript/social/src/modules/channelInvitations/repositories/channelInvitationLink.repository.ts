import type { Prisma } from "../../../generated/prisma/client.js";
import type { Db } from "../../../types/database.type.js";

export const channelInvitationLinkRepository = {
  create: (db: Db, data: Prisma.ChannelInvitationLinkUncheckedCreateInput) => db.channelInvitationLink.create({ data }),

  findActiveByTokenHash: (db: Db, tokenHash: string, now: Date) => db.channelInvitationLink.findFirst({
    where: { tokenHash, revokedAt: null, expiresAt: { gt: now }, conversation: { kind: "channel" } },
    include: { conversation: { include: { members: { where: { leftAt: null } } } } },
  }),

  findByIdForChannel: (db: Db, id: string, conversationId: string) => db.channelInvitationLink.findFirst({ where: { id, conversationId } }),

  findCursorInChannel: (db: Db, id: string, conversationId: string) => db.channelInvitationLink.findFirst({
    where: { id, conversationId }, select: { id: true },
  }),

  pageForChannel: (db: Db, conversationId: string, limit: number, cursor?: string) => db.channelInvitationLink.findMany({
    where: { conversationId, conversation: { kind: "channel" } },
    select: { id: true, conversationId: true, createdAt: true, expiresAt: true, revokedAt: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
  }),

  revoke: (db: Db, id: string, conversationId: string, now: Date) => db.channelInvitationLink.updateMany({
    where: { id, conversationId, revokedAt: null }, data: { revokedAt: now },
  }),
};
