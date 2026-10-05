import type { QueryClient } from "@tanstack/react-query";

import { chatCryptoService } from "@/services/chatCrypto/chatCrypto.service";
import type { Conversation, Message, MessageReactionSummary, RealtimeServerEvent } from "@/types";

import { messageHistoryStore } from "./messageHistory.database";
import type { LocallyStoredMessage } from "./messageHistory.type";

export function insertOrReplaceCachedMessage(queryClient: QueryClient, message: Message) {
  queryClient.setQueryData<LocallyStoredMessage[]>(["messages", message.conversationId], (existing) => {
    if (!existing) return existing;
    const alreadyPresent = existing.some((cached) => cached.id === message.id);
    return alreadyPresent
      ? existing.map((cached) => (cached.id === message.id ? { ...message, deliveryStatus: "sent" } : cached))
      : [...existing, { ...message, deliveryStatus: "sent" }];
  });
}

export function replaceCachedMessageReactions(
  queryClient: QueryClient,
  conversationId: string,
  messageId: string,
  reactions: readonly MessageReactionSummary[],
) {
  let updatedMessage: LocallyStoredMessage | null = null;
  queryClient.setQueryData<LocallyStoredMessage[]>(["messages", conversationId], (existing) =>
    existing?.map((cached) => {
      if (cached.id !== messageId) return cached;
      updatedMessage = { ...cached, reactions };
      return updatedMessage;
    }),
  );
  if (updatedMessage && (updatedMessage as LocallyStoredMessage).deliveryStatus === "sent") messageHistoryStore.saveDeliveredMessages([updatedMessage]);
}

function applyConversationUpdate(queryClient: QueryClient, conversation: Conversation) {
  messageHistoryStore.saveConversations([conversation]);
  queryClient.setQueryData<Conversation>(["conversation", conversation.id], (existing) => (existing ? { ...existing, ...conversation } : existing));
  queryClient.invalidateQueries({ queryKey: ["conversations"] });
}

export function applyRealtimeEventToLocalCaches(queryClient: QueryClient, event: RealtimeServerEvent) {
  switch (event.type) {
    case "message.created":
    case "message.updated":
      messageHistoryStore.saveDeliveredMessages([event.message]);
      insertOrReplaceCachedMessage(queryClient, event.message);
      if (event.type === "message.created") queryClient.invalidateQueries({ queryKey: ["conversations"] });
      return;
    case "conversation.updated":
      applyConversationUpdate(queryClient, event.conversation);
      return;
    case "reaction":
      replaceCachedMessageReactions(queryClient, event.conversationId, event.messageId, event.reactions);
      return;
    default:
      return;
  }
}

export function removeExpiredMessagesFromCaches(queryClient: QueryClient, conversationId: string) {
  messageHistoryStore.deleteExpiredMessages();
  const now = new Date().toISOString();
  queryClient.setQueryData<LocallyStoredMessage[]>(["messages", conversationId], (existing) => {
    const expiredIds = existing?.filter((message) => message.expiresAt && message.expiresAt <= now).map((message) => message.id) ?? [];
    if (expiredIds.length === 0 || !existing) return existing;
    void chatCryptoService.forgetMessages(expiredIds).catch(() => undefined);
    return existing.filter((message) => !message.expiresAt || message.expiresAt > now);
  });
}
