import type { HandlerContext } from "../../../types/handlerContext.type.js";
import type { Db } from "../../../types/database.type.js";
import type { ConversationRow } from "../../conversations/repositories/conversation.repository.js";
import type { MessageRow } from "../../messages/repositories/message.repository.js";
import { buildMessageViews } from "../../messages/services/messageView.service.js";
import type { StoreConversationView, StoreMessageView } from "../models/storeInbox.model.js";
import { storeInboxRepository } from "../repositories/storeInbox.repository.js";

export function buyerIdOf(conversation: ConversationRow, storeId: string): string {
  return conversation.members.find((member) => member.accountId !== storeId)?.accountId ?? conversation.createdById;
}

export async function buildStoreConversationViews(context: HandlerContext, db: Db, storeId: string, conversations: readonly ConversationRow[]): Promise<StoreConversationView[]> {
  const buyerIds = conversations.map((conversation) => buyerIdOf(conversation, storeId));
  const [summaries, latest] = await Promise.all([context.directory.findUserSummaries(buyerIds), storeInboxRepository.latestMessages(db, conversations.map((conversation) => conversation.id))]);
  const latestByConversation = new Map(latest.map((message) => [message.conversationId, message]));
  return conversations.map((conversation) => {
    const buyerId = buyerIdOf(conversation, storeId);
    const summary = summaries.get(buyerId);
    const last = latestByConversation.get(conversation.id);
    const storeMember = conversation.members.find((member) => member.accountId === storeId);
    const buyerMember = conversation.members.find((member) => member.accountId === buyerId);
    return {
      id: conversation.id,
      customer: { id: buyerId, name: summary?.name ?? "Zudomart user", username: summary?.username ?? "", avatarUrl: summary?.avatarUrl ?? null },
      orderId: conversation.orderId, orderNumber: conversation.orderNumber,
      lastMessage: last === undefined ? null : { kind: last.kind, from: last.senderId === buyerId ? "customer" : "seller", createdAt: last.createdAt.toISOString() },
      unreadCount: storeMember?.unreadCount ?? 0,
      customerLastReadAt: buyerMember?.lastReadAt?.toISOString() ?? null,
      updatedAt: conversation.lastMessageAt.toISOString(),
    };
  });
}

export async function buildStoreMessageViews(context: HandlerContext, viewerId: string, rows: readonly MessageRow[], buyerId: string, customerName: string): Promise<StoreMessageView[]> {
  const views = await buildMessageViews(context, viewerId, rows, { peerLastReadAt: null, isDirect: false });
  return views.map((view, index) => {
    const fromCustomer = view.senderId === buyerId;
    return { ...view, from: fromCustomer ? "customer" : "seller", senderName: fromCustomer ? customerName : (rows[index]?.senderLabel ?? "Store") };
  });
}
