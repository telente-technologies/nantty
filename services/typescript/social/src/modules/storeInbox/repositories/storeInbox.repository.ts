import type { Db } from "../../../types/database.type.js";
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
    db.message.findMany({ where: { conversationId: { in: [...conversationIds] }, kind: "text" }, orderBy: { id: "desc" }, distinct: ["conversationId"], select: { conversationId: true, senderId: true, ciphertext: true, createdAt: true } }),

  threadMessages: (db: Db, conversationId: string, limit: number) =>
    db.message.findMany({ where: { conversationId, kind: "text" }, orderBy: { id: "desc" }, take: limit, select: { id: true, conversationId: true, senderId: true, senderLabel: true, ciphertext: true, protocol: true, createdAt: true } }),
};
