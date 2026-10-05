import type { HandlerContext } from "../../../types/handlerContext.type.js";
import type { Db } from "../../../types/database.type.js";
import type { ConversationRow } from "../../conversations/repositories/conversation.repository.js";
import { storePlaintextProtocol, type StoreConversationView, type StoreMessageView } from "../models/storeInbox.model.js";
import { storeInboxRepository } from "../repositories/storeInbox.repository.js";

const markupPattern = /<[^>]*>/g;
const controlPattern = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function cleanStoreMessageBody(raw: string): string {
  return raw.replace(markupPattern, "").replace(controlPattern, "").trim();
}

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
    return {
      id: conversation.id,
      customer: { id: buyerId, name: summary?.name ?? "Zudomart user", username: summary?.username ?? "", avatarUrl: summary?.avatarUrl ?? null },
      orderId: conversation.orderId, orderNumber: conversation.orderNumber,
      lastMessage: last === undefined ? null : { body: last.ciphertext ?? "", from: last.senderId === storeId ? "seller" : "customer", createdAt: last.createdAt.toISOString() },
      unreadCount: storeMember?.unreadCount ?? 0,
      updatedAt: conversation.lastMessageAt.toISOString(),
    };
  });
}

export function buildStoreMessageView(message: { readonly id: string; readonly conversationId: string; readonly senderId: string; readonly senderLabel: string | null; readonly ciphertext: string | null; readonly protocol: string; readonly createdAt: Date }, storeId: string, customerName: string): StoreMessageView {
  const fromStore = message.senderId === storeId;
  return {
    id: message.id, conversationId: message.conversationId, from: fromStore ? "seller" : "customer",
    senderName: fromStore ? (message.senderLabel ?? "Store") : customerName,
    body: message.protocol === storePlaintextProtocol ? (message.ciphertext ?? "") : "This message is end-to-end encrypted.",
    createdAt: message.createdAt.toISOString(),
  };
}
