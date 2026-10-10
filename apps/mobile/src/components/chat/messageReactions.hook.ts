import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { replaceCachedMessageReactions } from "@/cache/messageRealtimeCache.util";
import type { LocallyStoredMessage } from "@/cache/messageHistory.type";
import { messagesService } from "@/services/chat/messages.service";
import type { MessageReactionSummary } from "@/types";

const applyReactionToggleLocally = (reactions: readonly MessageReactionSummary[], emoji: string, shouldReact: boolean) => {
  const existing = reactions.find((reaction) => reaction.emoji === emoji);
  if (!existing) return shouldReact ? [...reactions, { emoji, count: 1, reactedByMe: true }] : [...reactions];
  if (existing.reactedByMe === shouldReact) return [...reactions];
  return reactions
    .map((reaction) =>
      reaction.emoji === emoji ? { ...reaction, count: reaction.count + (shouldReact ? 1 : -1), reactedByMe: shouldReact } : reaction,
    )
    .filter((reaction) => reaction.count > 0);
};

export function useMessageReactionToggle(conversationId: string | undefined) {
  const queryClient = useQueryClient();
  return useCallback(
    async (message: LocallyStoredMessage, emoji: string, shouldReact: boolean) => {
      if (!conversationId || message.deliveryStatus !== "sent") return;
      const previousReactions = message.reactions ?? [];
      replaceCachedMessageReactions(queryClient, conversationId, message.id, applyReactionToggleLocally(previousReactions, emoji, shouldReact));
      try {
        const serverReactions = shouldReact
          ? await messagesService.addReactionToMessage(message.id, emoji)
          : await messagesService.removeReactionFromMessage(message.id, emoji);
        replaceCachedMessageReactions(queryClient, conversationId, message.id, serverReactions);
      } catch {
        replaceCachedMessageReactions(queryClient, conversationId, message.id, previousReactions);
      }
    },
    [conversationId, queryClient],
  );
}
