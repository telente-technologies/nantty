import type { InboxFolder, MemberRole, Prisma } from "../../../generated/prisma/client.js";
import type { Db } from "../../../types/database.type.js";

export const conversationWithMembers = { members: { where: { leftAt: null } } } satisfies Prisma.ConversationInclude;
export type ConversationRow = Prisma.ConversationGetPayload<{ include: typeof conversationWithMembers }>;
export type MemberRow = Prisma.ConversationMemberGetPayload<object>;
export type MemberWithConversation = Prisma.ConversationMemberGetPayload<{ include: { conversation: { include: typeof conversationWithMembers } } }>;

export const buildDirectKey = (accountA: string, accountB: string): string => (accountA < accountB ? `${accountA}:${accountB}` : `${accountB}:${accountA}`);

export const conversationRepository = {
  findById: (db: Db, id: string): Promise<ConversationRow | null> => db.conversation.findUnique({ where: { id }, include: conversationWithMembers }),

  findDirectByKey: (db: Db, directKey: string): Promise<ConversationRow | null> => db.conversation.findUnique({ where: { directKey }, include: conversationWithMembers }),

  create: (db: Db, data: Prisma.ConversationUncheckedCreateInput, members: readonly { readonly accountId: string; readonly role: MemberRole; readonly inboxFolder: InboxFolder; readonly spamReason?: string | null }[]): Promise<ConversationRow> =>
    db.conversation.create({
      data: { ...data, members: { create: members.map((member) => ({ accountId: member.accountId, role: member.role, inboxFolder: member.inboxFolder, spamReason: member.spamReason ?? null })) } },
      include: conversationWithMembers,
    }),

  update: (db: Db, id: string, data: Prisma.ConversationUncheckedUpdateInput) => db.conversation.update({ where: { id }, data }),

  findMember: (db: Db, conversationId: string, accountId: string): Promise<MemberRow | null> =>
    db.conversationMember.findFirst({ where: { conversationId, accountId, leftAt: null } }),

  updateMember: (db: Db, conversationId: string, accountId: string, data: Prisma.ConversationMemberUncheckedUpdateInput) =>
    db.conversationMember.update({ where: { conversationId_accountId: { conversationId, accountId } }, data }),

  upsertMember: (db: Db, conversationId: string, accountId: string, role: MemberRole, inboxFolder: InboxFolder) =>
    db.conversationMember.upsert({
      where: { conversationId_accountId: { conversationId, accountId } },
      create: { conversationId, accountId, role, inboxFolder },
      update: { leftAt: null, role, inboxFolder },
    }),

  pageForMember: (db: Db, accountId: string, folder: InboxFolder, kinds: readonly ("direct" | "group" | "channel" | "business")[] | undefined, limit: number, cursor: string | undefined): Promise<MemberWithConversation[]> =>
    db.conversationMember.findMany({
      where: { accountId, inboxFolder: folder, leftAt: null, ...(kinds === undefined ? {} : { conversation: { kind: { in: [...kinds] } } }) },
      include: { conversation: { include: conversationWithMembers } },
      orderBy: [{ conversation: { lastMessageAt: "desc" } }, { conversationId: "desc" }],
      take: limit + 1,
      ...(cursor === undefined ? {} : { cursor: { conversationId_accountId: { conversationId: cursor, accountId } }, skip: 1 }),
    }),

  touchLastMessage: (db: Db, conversationId: string, kind: Prisma.ConversationUncheckedUpdateInput["lastMessageKind"], at: Date) =>
    db.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: at, lastMessageKind: kind } }),

  incrementUnreadForOthers: (db: Db, conversationId: string, senderId: string) =>
    db.conversationMember.updateMany({ where: { conversationId, accountId: { not: senderId }, leftAt: null }, data: { unreadCount: { increment: 1 } } }),

  markRead: (db: Db, conversationId: string, accountId: string, at: Date) =>
    db.conversationMember.updateMany({ where: { conversationId, accountId }, data: { unreadCount: 0, lastReadAt: at } }),

  countMembers: (db: Db, conversationId: string) => db.conversationMember.count({ where: { conversationId, leftAt: null } }),

  memberIds: async (db: Db, conversationId: string): Promise<string[]> =>
    (await db.conversationMember.findMany({ where: { conversationId, leftAt: null }, select: { accountId: true } })).map((row) => row.accountId),
};
