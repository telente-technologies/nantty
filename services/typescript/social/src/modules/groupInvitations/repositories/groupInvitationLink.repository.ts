import type { Prisma } from "../../../generated/prisma/client.js";
import type { Db } from "../../../types/database.type.js";

export const groupInvitationLinkRepository = {
  create: (db: Db, data: Prisma.GroupInvitationLinkUncheckedCreateInput) => db.groupInvitationLink.create({ data }),

  findActiveByTokenHash: (db: Db, tokenHash: string, now: Date) => db.groupInvitationLink.findFirst({
    where: { tokenHash, revokedAt: null, expiresAt: { gt: now }, conversation: { kind: "group" } },
    include: { conversation: { include: { members: { where: { leftAt: null } } } } },
  }),

  findByIdForConversation: (db: Db, id: string, conversationId: string) =>
    db.groupInvitationLink.findFirst({ where: { id, conversationId } }),

  findCursorInConversation: (db: Db, id: string, conversationId: string) =>
    db.groupInvitationLink.findFirst({ where: { id, conversationId }, select: { id: true } }),

  pageForConversation: (db: Db, conversationId: string, limit: number, cursor?: string) => db.groupInvitationLink.findMany({
    where: { conversationId },
    select: { id: true, conversationId: true, createdAt: true, expiresAt: true, revokedAt: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
  }),

  revoke: (db: Db, id: string, conversationId: string, now: Date) => db.groupInvitationLink.updateMany({
    where: { id, conversationId, revokedAt: null },
    data: { revokedAt: now },
  }),
};
