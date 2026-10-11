import { readMockDatabase, readStoreScopedMockSlice } from "@/mocks/mockDatabase.mock";
import { MockHttpError } from "@/mocks/mockResponses.mock";
import { buildDemoConversations, type MockConversationRecord } from "@/mocks/seed/demoConversations.mock";
import type { Conversation, ConversationMessage } from "@/types/conversation.type";
import type { OnlineOrder } from "@/types/order.type";

export function readConversationRecords(): MockConversationRecord[] {
  return readStoreScopedMockSlice("conversations", () => {
    const database = readMockDatabase();
    return buildDemoConversations(database.onlineOrders, database.settings.name);
  });
}

export function findConversationRecordOrThrow(conversationId: string): MockConversationRecord {
  const record = readConversationRecords().find((candidate) => candidate.conversation.id === conversationId);
  if (!record) throw new MockHttpError(404, "CONVERSATION_NOT_FOUND", "That conversation no longer exists.");
  return record;
}

export function appendMessageToConversation(record: MockConversationRecord, message: ConversationMessage): void {
  record.messages.push(message);
  if (message.kind === "control") return;
  const isFromSeller = message.from === "seller";
  record.conversation = {
    ...record.conversation,
    lastMessage: { kind: message.kind, from: message.from, createdAt: message.createdAt },
    unreadCount: isFromSeller ? 0 : record.conversation.unreadCount + 1,
    updatedAt: message.createdAt,
  };
}

export function findOrCreateConversationForOrder(order: OnlineOrder): Conversation {
  const records = readConversationRecords();
  const existing = records.find((record) => record.conversation.orderId === order.id || (order.conversationId !== null && record.conversation.id === order.conversationId));
  if (existing) return existing.conversation;
  const conversation: Conversation = {
    id: `conv_${order.id}`,
    customer: { id: order.buyer.id, name: order.buyer.name, username: order.buyer.username, avatarUrl: null },
    orderId: order.id,
    orderNumber: order.orderNumber,
    lastMessage: null,
    unreadCount: 0,
    updatedAt: new Date().toISOString(),
  };
  records.unshift({ conversation, messages: [], seeds: [] });
  return conversation;
}
