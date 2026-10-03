import { ApiError } from "@/errors/api.error";
import type { ChatMuteDuration, ChatSettings } from "@/types";

import {
  acceptMessageRequestState,
  applyMuteState,
  chatSettingsState,
  decorateConversation,
  deleteConversationState,
  markNotSpamState,
  updateChatSettingsState,
} from "./chatInboxState.mock";
import { acknowledgeStreakCelebration, restoreStreakForViewer } from "./chatStreakEngine.mock";
import { findMockConversation } from "./chats.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";
import { blockedUserIds } from "./socialGraph.mock";

export const chatInboxMocks: MockRoute[] = [
  createMockRoute("POST", "/api/v1/conversations/:conversationId/accept", ({ params }) => {
    acceptMessageRequestState(params.conversationId!);
    return decorateConversation(findMockConversation(params.conversationId!));
  }),
  createMockRoute("DELETE", "/api/v1/conversations/:conversationId", ({ params }) => void deleteConversationState(params.conversationId!)),
  createMockRoute("POST", "/api/v1/conversations/:conversationId/block", ({ params }) => {
    blockedUserIds.add(findMockConversation(params.conversationId!).peer.id);
    deleteConversationState(params.conversationId!);
  }),
  createMockRoute("POST", "/api/v1/conversations/:conversationId/not-spam", ({ params }) => {
    markNotSpamState(params.conversationId!);
    return decorateConversation(findMockConversation(params.conversationId!));
  }),
  createMockRoute("PUT", "/api/v1/conversations/:conversationId/mute", ({ params, body }) => ({
    mutedUntil: applyMuteState(params.conversationId!, (body as { duration: ChatMuteDuration }).duration),
  })),
  createMockRoute("GET", "/api/v1/chat/settings", () => chatSettingsState),
  createMockRoute("PATCH", "/api/v1/chat/settings", ({ body }) => updateChatSettingsState(body as Partial<ChatSettings>)),
  createMockRoute("POST", "/api/v1/conversations/:conversationId/streak/restore", ({ params }) => {
    const restoredStreak = restoreStreakForViewer(params.conversationId!);
    if (!restoredStreak) throw new ApiError(409, "Nothing to restore");
    return restoredStreak;
  }),
  createMockRoute("POST", "/api/v1/conversations/:conversationId/streak/celebrated", ({ params }) => void acknowledgeStreakCelebration(params.conversationId!)),
];
