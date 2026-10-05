import type { ChatSearchResults, Page } from "@/types";
import type { Conversation, ConversationFilter, Message, UserSummary } from "@/types";

import { chatCryptoService } from "./chatCrypto/chatCrypto.service";
import { createIdempotencyKey, sendListRequestToWebappServer, sendRequestToWebappServer } from "./clientApi.service";

export const messagesService = {
  fetchConversationList: (filter: ConversationFilter) =>
    sendListRequestToWebappServer<Conversation>("/api/v1/conversations", { query: { filter } }),
  fetchConversationById: (conversationId: string) => sendRequestToWebappServer<Conversation>(`/api/v1/conversations/${conversationId}`),
  fetchMessagesInConversation: (conversationId: string, options: { readonly cursor?: string; readonly after?: string } = {}) =>
    sendRequestToWebappServer<Page<Message>>(`/api/v1/conversations/${conversationId}/messages`, {
      query: { cursor: options.cursor, after: options.after },
    }),
  startConversationWithUser: (userId: string) => sendRequestToWebappServer<Conversation>("/api/v1/conversations", { method: "POST", body: { userId } }),
  sendChatMessage: async (conversation: Conversation, viewerId: string, text: string): Promise<Message> => {
    const encrypted = await chatCryptoService.encryptForConversation(conversation, viewerId, { text });
    const message = await sendRequestToWebappServer<Message>(`/api/v1/conversations/${conversation.id}/messages`, {
      method: "POST",
      body: { kind: "text", encryption: encrypted.encryption },
      idempotencyKey: createIdempotencyKey("msg"),
    });
    await encrypted.confirmSent(message.id);
    return { ...message, text };
  },
  fetchDecryptedMessagesInConversation: async (conversationId: string, viewerId: string, options: { readonly cursor?: string; readonly after?: string } = {}): Promise<Page<Message>> => {
    const page = await messagesService.fetchMessagesInConversation(conversationId, options);
    return { ...page, data: await chatCryptoService.decryptMessages(page.data, viewerId) };
  },
  markConversationAsRead: (conversationId: string) => sendRequestToWebappServer<void>(`/api/v1/conversations/${conversationId}/read`, { method: "POST" }),
  searchConversationsAndPeople: (query: string) => sendRequestToWebappServer<ChatSearchResults>("/api/v1/conversations/search", { query: { q: query } }),
  fetchPeopleToMessage: (query: string) => sendListRequestToWebappServer<UserSummary>("/api/v1/search/people", { query: { q: query } }),
};
