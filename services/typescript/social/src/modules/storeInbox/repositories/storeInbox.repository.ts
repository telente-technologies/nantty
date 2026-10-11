import type { Db } from "../../../types/database.type.js";
import type { MessageRow } from "../../messages/repositories/message.repository.js";
import { conversationWithMembers, type ConversationRow } from "../../conversations/repositories/conversation.repository.js";

export const storeInboxRepository = {
  findForStore: (db: Db, storeId: string, conversationId: string): Promise<ConversationRow | null> =>
    db.conversation.findFirst({ where: { id: conversationId, storeId, kind: "business" }, include: conversationWithMembers }),

  listForStore: (db: Db, storeId: string, orderLinkedOnly: boolean, limit: number, cursor: string | undefined): Promise<ConversationRow[]> =>
    db.conversation.findMany({
      where: { storeId, kind: "business", ...(orderLinkedOnly ? { orderId: { not: null } } : {}) },
      include: conversationWithMembers,
      orderBy: [{ lastMessageAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
    }),

  countUnreadForStore: (db: Db, storeId: string): Promise<number> =>
    db.conversationMember.count({ where: { accountId: storeId, unreadCount: { gt: 0 }, leftAt: null, conversation: { storeId, kind: "business" } } }),

  latestMessages: (db: Db, conversationIds: readonly string[]) =>
    db.message.findMany({ where: { conversationId: { in: [...conversationIds] }, kind: { notIn: ["control", "system"] } }, orderBy: { id: "desc" }, distinct: ["conversationId"], select: { conversationId: true, senderId: true, kind: true, createdAt: true } }),

  threadMessages: (db: Db, conversationId: string, now: Date, limit: number, cursor: string | undefined): Promise<MessageRow[]> =>
    db.message.findMany({
      where: { conversationId, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      orderBy: { id: "desc" }, take: limit + 1, ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
    }),
};
