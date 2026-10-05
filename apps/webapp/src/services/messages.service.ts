import type { ChatSearchResults, Page } from "@/types";
import type { Conversation, ConversationFilter, Message, UserSummary } from "@/types";

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
  sendChatMessage: (conversationId: string, text: string) =>
    sendRequestToWebappServer<Message>(`/api/v1/conversations/${conversationId}/messages`, {
      method: "POST",
      body: { text },
      idempotencyKey: createIdempotencyKey("msg"),
    }),
  markConversationAsRead: (conversationId: string) => sendRequestToWebappServer<void>(`/api/v1/conversations/${conversationId}/read`, { method: "POST" }),
  searchConversationsAndPeople: (query: string) => sendRequestToWebappServer<ChatSearchResults>("/api/v1/conversations/search", { query: { q: query } }),
  fetchPeopleToMessage: (query: string) => sendListRequestToWebappServer<UserSummary>("/api/v1/search/people", { query: { q: query } }),
};
