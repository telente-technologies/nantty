import { runNowOrQueueWhenOffline } from "@/store/offline.store";
import type { ChatSearchResults, ConversationFilter, Conversation, Message, Page, UserSummary } from "@/types";

import { api } from "./apiClient.service";

export interface OutgoingMessageDraft {
  readonly conversationId: string;
  readonly senderId: string;
  readonly text: string;
  readonly localMessageId: string;
}

export const buildLocalPendingMessageFromDraft = (draft: OutgoingMessageDraft): Message => ({
  id: draft.localMessageId,
  conversationId: draft.conversationId,
  senderId: draft.senderId,
  text: draft.text,
  createdAt: new Date().toISOString(),
});

export const messagesService = {
  fetchConversationList: (filter: ConversationFilter) => api.get<Conversation[]>("/api/v1/conversations", { filter }),
  fetchConversationById: (conversationId: string) => api.get<Conversation>(`/api/v1/conversations/${conversationId}`),
  fetchMessagesInConversation: (conversationId: string, options: { readonly cursor?: string; readonly after?: string } = {}) =>
    api.get<Page<Message>>(`/api/v1/conversations/${conversationId}/messages`, { cursor: options.cursor, after: options.after }),
  startConversationWithUser: (userId: string) => api.post<Conversation>("/api/v1/conversations", { userId }),
  sendChatMessageOrQueueWhenOffline: async (draft: OutgoingMessageDraft): Promise<{ readonly message: Message; readonly delivered: boolean }> => {
    const deliveredMessage = await runNowOrQueueWhenOffline(
      { kind: "sendMessage", payload: { conversationId: draft.conversationId, text: draft.text, localMessageId: draft.localMessageId } },
      (idempotencyKey) =>
        api.post<Message>(`/api/v1/conversations/${draft.conversationId}/messages`, { text: draft.text }, { idempotencyKey }),
    );
    return deliveredMessage
      ? { message: deliveredMessage, delivered: true }
      : { message: buildLocalPendingMessageFromDraft(draft), delivered: false };
  },
  markConversationAsRead: (conversationId: string) => api.post<void>(`/api/v1/conversations/${conversationId}/read`),
  searchConversationsAndPeople: (query: string) => api.get<ChatSearchResults>("/api/v1/conversations/search", { q: query }),
  fetchPeopleToMessage: (query: string) => api.get<UserSummary[]>("/api/v1/search/people", { q: query }),
};
