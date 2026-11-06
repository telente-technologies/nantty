import type { ChannelInvitationStatus, Prisma } from "../../../generated/prisma/client.js";
import type { Db } from "../../../types/database.type.js";

export const channelInvitationRepository = {
  findPair: (db: Db, conversationId: string, inviteeId: string) => db.channelInvitation.findUnique({
    where: { conversationId_inviteeId: { conversationId, inviteeId } },
    include: { conversation: { select: { id: true, kind: true, title: true } } },
  }),

  findById: (db: Db, id: string) => db.channelInvitation.findUnique({
    where: { id }, include: { conversation: { select: { id: true, kind: true, title: true } } },
  }),

  create: (db: Db, data: Prisma.ChannelInvitationUncheckedCreateInput) => db.channelInvitation.create({ data }),

  update: (db: Db, id: string, data: Prisma.ChannelInvitationUncheckedUpdateInput) => db.channelInvitation.update({ where: { id }, data }),

  expirePendingForPair: (db: Db, conversationId: string, inviteeId: string, now: Date) => db.channelInvitation.updateMany({
    where: { conversationId, inviteeId, status: "pending", expiresAt: { lte: now } },
    data: { status: "expired", respondedAt: now },
  }),

  expirePendingForInvitee: (db: Db, inviteeId: string, now: Date) => db.channelInvitation.updateMany({
    where: { inviteeId, status: "pending", expiresAt: { lte: now }, conversation: { kind: "channel" } },
    data: { status: "expired", respondedAt: now },
  }),

  settlePending: (db: Db, id: string, inviteeId: string, status: Extract<ChannelInvitationStatus, "accepted" | "declined">, now: Date) => db.channelInvitation.updateMany({
    where: { id, inviteeId, status: "pending", expiresAt: { gt: now }, conversation: { kind: "channel" } },
    data: { status, respondedAt: now },
  }),

  pageForInvitee: (db: Db, inviteeId: string, status: ChannelInvitationStatus, limit: number, cursor?: string) => db.channelInvitation.findMany({
    where: { inviteeId, status, conversation: { kind: "channel" } },
    include: { conversation: { select: { id: true, title: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
  }),

  findCursorForInvitee: (db: Db, id: string, inviteeId: string) => db.channelInvitation.findFirst({
    where: { id, inviteeId, conversation: { kind: "channel" } }, select: { id: true },
  }),
};
