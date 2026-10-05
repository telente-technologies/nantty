import type { Conversation, ConversationMember, NewGroupConversationInput } from "@/types";

import { api } from "./apiClient.service";

export const groupsService = {
  createGroupConversation: (input: NewGroupConversationInput) => api.post<Conversation>("/api/v1/conversations/groups", input),
  fetchConversationMembers: (conversationId: string) => api.getList<ConversationMember>(`/api/v1/conversations/${conversationId}/members`),
  addMembersToGroup: (conversationId: string, userIds: readonly string[]) =>
    api.post<ConversationMember[]>(`/api/v1/conversations/${conversationId}/members`, { userIds }),
  removeMemberFromGroup: (conversationId: string, userId: string) =>
    api.delete<void>(`/api/v1/conversations/${conversationId}/members/${userId}`),
  promoteMemberToAdmin: (conversationId: string, userId: string) =>
    api.post<void>(`/api/v1/conversations/${conversationId}/admins`, { userId }),
  demoteAdminToMember: (conversationId: string, userId: string) =>
    api.delete<void>(`/api/v1/conversations/${conversationId}/admins/${userId}`),
  leaveConversation: (conversationId: string) => api.post<void>(`/api/v1/conversations/${conversationId}/leave`),
};
