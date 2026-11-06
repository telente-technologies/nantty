import type { GroupInvitationStatus, Prisma } from "../../../generated/prisma/client.js";
import type { Db } from "../../../types/database.type.js";

export const groupInvitationRepository = {
  findPair: (db: Db, conversationId: string, inviteeId: string) =>
    db.groupMembershipInvitation.findUnique({ where: { conversationId_inviteeId: { conversationId, inviteeId } } }),

  findById: (db: Db, id: string) => db.groupMembershipInvitation.findUnique({ where: { id } }),

  create: (db: Db, data: Prisma.GroupMembershipInvitationUncheckedCreateInput) =>
    db.groupMembershipInvitation.create({ data }),

  update: (db: Db, id: string, data: Prisma.GroupMembershipInvitationUncheckedUpdateInput) =>
    db.groupMembershipInvitation.update({ where: { id }, data }),

  updatePendingForPair: (db: Db, conversationId: string, inviteeId: string, now: Date) =>
    db.groupMembershipInvitation.updateMany({
      where: { conversationId, inviteeId, status: "pending", expiresAt: { lte: now } },
      data: { status: "expired", respondedAt: now },
    }),

  countOpenForConversation: (db: Db, conversationId: string, now: Date) =>
    db.groupMembershipInvitation.count({
      where: { conversationId, OR: [{ status: "accepted" }, { status: "pending", expiresAt: { gt: now } }] },
    }),

  expirePendingForAccount: (db: Db, accountId: string, now: Date) =>
    db.groupMembershipInvitation.updateMany({
      where: { status: "pending", expiresAt: { lte: now }, OR: [{ inviterId: accountId }, { inviteeId: accountId }] },
      data: { status: "expired", respondedAt: now },
    }),

  pageForAccount: (db: Db, accountId: string, direction: "received" | "sent", status: "pending" | "accepted", limit: number, cursor?: string) =>
    db.groupMembershipInvitation.findMany({
      where: { status, ...(direction === "received" ? { inviteeId: accountId } : { inviterId: accountId }) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
    }),

  settlePending: (db: Db, id: string, accountId: string, status: Extract<GroupInvitationStatus, "accepted" | "declined">, now: Date) =>
    db.groupMembershipInvitation.updateMany({
      where: { id, inviteeId: accountId, status: "pending", expiresAt: { gt: now } },
      data: { status, respondedAt: now },
    }),
};
