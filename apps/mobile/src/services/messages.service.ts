import type { ChatSearchResults, ConversationFilter, Conversation, Message, Page, UserSummary } from "@/types";

import { api } from "./api-client.service";

export const messagesService = {
  fetchConversationList: (filter: ConversationFilter) => api.get<Conversation[]>("/api/v1/conversations", { filter }),
  fetchConversationById: (conversationId: string) => api.get<Conversation>(`/api/v1/conversations/${conversationId}`),
  fetchMessagesInConversation: (conversationId: string, cursor?: string) =>
    api.get<Page<Message>>(`/api/v1/conversations/${conversationId}/messages`, { cursor }),
  startConversationWithUser: (userId: string) => api.post<Conversation>("/api/v1/conversations", { userId }),
  sendChatMessageToConversation: (conversationId: string, text: string) =>
    api.post<Message>(`/api/v1/conversations/${conversationId}/messages`, { text }),
  markConversationAsRead: (conversationId: string) => api.post<void>(`/api/v1/conversations/${conversationId}/read`),
  searchConversationsAndPeople: (query: string) => api.get<ChatSearchResults>("/api/v1/conversations/search", { q: query }),
  fetchPeopleToMessage: (query: string) => api.get<UserSummary[]>("/api/v1/search/people", { q: query }),
};
