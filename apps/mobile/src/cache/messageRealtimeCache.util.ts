import type { QueryClient } from "@tanstack/react-query";

import { chatCryptoService } from "@/services/chatCrypto/chatCrypto.service";
import type { Conversation, Message, RealtimeServerEvent } from "@/types";

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

export function storeDeliveredMessage(queryClient: QueryClient, message: Message) {
  const existing = queryClient.getQueryData<LocallyStoredMessage[]>(["messages", message.conversationId])?.find((cached) => cached.id === message.id);
  if (message.decryptionNotice && existing && !existing.decryptionNotice) return;
  messageHistoryStore.saveDeliveredMessages([message]);
  insertOrReplaceCachedMessage(queryClient, message);
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
      storeDeliveredMessage(queryClient, event.message);
      if (event.message.control?.type === "groupUpdate") {
        queryClient.invalidateQueries({ queryKey: ["conversation", event.message.conversationId] });
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
      } else if (event.type === "message.created" && event.message.kind !== "control") queryClient.invalidateQueries({ queryKey: ["conversations"] });
      return;
    case "conversation.updated":
      applyConversationUpdate(queryClient, event.conversation);
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
