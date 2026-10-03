import { appendMessageToConversation, findConversationRecordOrThrow, readConversationRecords } from "@/mocks/handlers/conversationMockStore.mock";
import { matchesSearchText, paginateMockList, readJsonObjectBody, requireMockStorePrincipal, respondWithJson, respondWithValidationFailure } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";
import type { ConversationMessage } from "@/types/conversation.type";

export function registerConversationMockHandlers(): void {
  registerMockRoute("GET", "/seller/conversations", (request) => {
    requireMockStorePrincipal(request);
    const filter = request.query.get("filter");
    const records = readConversationRecords();
    const conversations = records
      .map((record) => record.conversation)
      .filter((conversation) => (filter === "unread" ? conversation.unreadCount > 0 : filter === "orders" ? conversation.orderId !== null : true))
      .filter((conversation) => matchesSearchText(request.query.get("q"), conversation.customer.name, conversation.customer.username, conversation.orderNumber, conversation.lastMessage?.body))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    const unreadConversationsCount = records.filter((record) => record.conversation.unreadCount > 0).length;
    return respondWithJson(200, { ...paginateMockList(conversations, request.query, 50), unreadConversationsCount });
  });

  registerMockRoute("GET", "/seller/conversations/:conversationId", (request) => {
    requireMockStorePrincipal(request);
    const record = findConversationRecordOrThrow(request.params.conversationId ?? "");
    return respondWithJson(200, { conversation: record.conversation, messages: record.messages });
  });

  registerMockRoute("POST", "/seller/conversations/:conversationId/messages", (request) => {
    const principal = requireMockStorePrincipal(request);
    const record = findConversationRecordOrThrow(request.params.conversationId ?? "");
    const body = String(readJsonObjectBody(request).body ?? "").trim();
    if (body.length < 1 || body.length > 2000) return respondWithValidationFailure([{ path: "body", message: "Write a message of up to 2000 characters." }]);
    const message: ConversationMessage = { id: `msg_${crypto.randomUUID().slice(0, 12)}`, conversationId: record.conversation.id, from: "seller", senderName: principal.actorName, body, createdAt: new Date().toISOString() };
    appendMessageToConversation(record, message);
    return respondWithJson(201, message);
  });

  registerMockRoute("POST", "/seller/conversations/:conversationId/read", (request) => {
    requireMockStorePrincipal(request);
    const record = findConversationRecordOrThrow(request.params.conversationId ?? "");
    record.conversation = { ...record.conversation, unreadCount: 0 };
    return respondWithJson(200, record.conversation);
  });
}
