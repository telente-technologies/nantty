import type {
  ChatMuteDuration,
  ChatSettings,
  ChatStreak,
  SendToChatsInput,
  SendToChatsResult,
  SharedContentCard,
  SharedContentReference,
} from "@/types";

import { api } from "../core/apiClient.service";

export const chatSafetyService = {
  fetchChatSettings: () => api.get<ChatSettings>("/api/v1/chat/settings"),
  updateChatSettings: (update: Partial<ChatSettings>) => api.patch<ChatSettings>("/api/v1/chat/settings", update),
  setConversationMute: (conversationId: string, duration: ChatMuteDuration) =>
    api.put<{ mutedUntil: string | null }>(`/api/v1/conversations/${conversationId}/mute`, { duration }),
  resolveSharedContent: (reference: SharedContentReference) =>
    api.get<SharedContentCard>("/api/v1/chat/content", { kind: reference.kind, id: reference.id }),
  sendContentToChats: (input: SendToChatsInput) => api.post<SendToChatsResult>("/api/v1/chat/shares", input),
  restoreStreak: (conversationId: string) => api.post<ChatStreak>(`/api/v1/conversations/${conversationId}/streak/restore`),
  acknowledgeStreakCelebration: (conversationId: string) => api.post<void>(`/api/v1/conversations/${conversationId}/streak/celebrated`),
};
