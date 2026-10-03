import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import type { LocalMessageDeliveryStatus, LocallyStoredMessage } from "@/cache/messageHistory.type";
import {
  markPendingMessageAsFailedLocally,
  replacePendingMessageWithDeliveredMessageLocally,
  savePendingOutgoingMessageLocally,
} from "@/cache/messageSync.util";
import { generateIdempotencyKey } from "@/services/apiClient.service";
import { buildLocalPendingMessageFromDraft, messagesService } from "@/services/messages.service";
import { buildLinkPreviewOnSenderDevice } from "@/services/linkPreviews.service";
import type { Message } from "@/types";

export function useOptimisticChatMessageSender(conversationId: string | undefined, myUserId: string) {
  const queryClient = useQueryClient();

  const updateCachedConversationMessages = useCallback(
    (change: (messages: LocallyStoredMessage[]) => LocallyStoredMessage[]) =>
      queryClient.setQueryData<LocallyStoredMessage[]>(["messages", conversationId], (existing) => change(existing ?? [])),
    [conversationId, queryClient],
  );

  const replaceCachedMessage = useCallback(
    (localMessageId: string, replacement: Message, deliveryStatus: LocalMessageDeliveryStatus) =>
      updateCachedConversationMessages((messages) =>
        messages.map((message) => (message.id === localMessageId ? { ...replacement, deliveryStatus } : message)),
      ),
    [updateCachedConversationMessages],
  );

  return useCallback(
    async (text: string) => {
      if (!conversationId) return;
      const linkPreview = await buildLinkPreviewOnSenderDevice(text);
      const draft = { conversationId, senderId: myUserId, text, linkPreview, localMessageId: `local_${generateIdempotencyKey()}` };
      const pendingMessage = buildLocalPendingMessageFromDraft(draft);
      savePendingOutgoingMessageLocally(pendingMessage);
      updateCachedConversationMessages((messages) => [...messages, { ...pendingMessage, deliveryStatus: "pending" }]);
      try {
        const result = await messagesService.sendChatMessageOrQueueWhenOffline(draft);
        if (!result.delivered) return;
        replacePendingMessageWithDeliveredMessageLocally(draft.localMessageId, result.message);
        replaceCachedMessage(draft.localMessageId, result.message, "sent");
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
        queryClient.invalidateQueries({ queryKey: ["conversation"] });
      } catch {
        markPendingMessageAsFailedLocally(draft.localMessageId);
        replaceCachedMessage(draft.localMessageId, pendingMessage, "failed");
      }
    },
    [conversationId, myUserId, queryClient, replaceCachedMessage, updateCachedConversationMessages],
  );
}
