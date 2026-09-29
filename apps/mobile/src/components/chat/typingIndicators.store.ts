import { create } from "zustand";

import type { UserSummary } from "@/types";

const TYPING_INDICATOR_TIMEOUT_MS = 6_000;

interface TypingIndicatorsState {
  readonly typingUsersByConversationId: Readonly<Record<string, readonly UserSummary[]>>;
  readonly setUserTypingInConversation: (conversationId: string, user: UserSummary, isTyping: boolean) => void;
}

const typingExpiryTimers = new Map<string, ReturnType<typeof setTimeout>>();

export const useTypingIndicatorsStore = create<TypingIndicatorsState>((set, get) => ({
  typingUsersByConversationId: {},
  setUserTypingInConversation: (conversationId, user, isTyping) => {
    const timerKey = `${conversationId}:${user.id}`;
    const existingTimer = typingExpiryTimers.get(timerKey);
    if (existingTimer) clearTimeout(existingTimer);
    const othersTyping = (get().typingUsersByConversationId[conversationId] ?? []).filter((typingUser) => typingUser.id !== user.id);
    set({ typingUsersByConversationId: { ...get().typingUsersByConversationId, [conversationId]: isTyping ? [...othersTyping, user] : othersTyping } });
    if (isTyping) {
      typingExpiryTimers.set(
        timerKey,
        setTimeout(() => get().setUserTypingInConversation(conversationId, user, false), TYPING_INDICATOR_TIMEOUT_MS),
      );
    }
  },
}));

const NO_ONE_TYPING: readonly UserSummary[] = [];

export const useUsersTypingInConversation = (conversationId: string | undefined) =>
  useTypingIndicatorsStore((state) => (conversationId ? state.typingUsersByConversationId[conversationId] ?? NO_ONE_TYPING : NO_ONE_TYPING));
