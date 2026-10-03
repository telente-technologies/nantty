import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import type { LocallyStoredMessage } from "@/cache/messageHistory.type";
import type { Message } from "@/types";

export function useConversationMessageCache(conversationId: string | undefined) {
  const queryClient = useQueryClient();

  const updateCachedMessages = useCallback(
    (change: (messages: LocallyStoredMessage[]) => LocallyStoredMessage[]) =>
      queryClient.setQueryData<LocallyStoredMessage[]>(["messages", conversationId], (existing) => change(existing ?? [])),
    [conversationId, queryClient],
  );

  const replaceCachedMessage = useCallback(
    (messageId: string, replacement: LocallyStoredMessage) =>
      updateCachedMessages((messages) => messages.map((message) => (message.id === messageId ? replacement : message))),
    [updateCachedMessages],
  );

  const applyServerVersionOfMessage = useCallback(
    (serverMessage: Message) => replaceCachedMessage(serverMessage.id, { ...serverMessage, deliveryStatus: "sent" }),
    [replaceCachedMessage],
  );

  const removeCachedMessage = useCallback(
    (messageId: string) => updateCachedMessages((messages) => messages.filter((message) => message.id !== messageId)),
    [updateCachedMessages],
  );

  return { queryClient, updateCachedMessages, replaceCachedMessage, applyServerVersionOfMessage, removeCachedMessage };
}
