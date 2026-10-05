import { useCallback } from "react";

import type { LocallyStoredMessage } from "@/cache/messageHistory.type";
import {
  deleteLocalMessage,
  markPendingMessageAsFailedLocally,
  replacePendingMessageWithDeliveredMessageLocally,
  savePendingOutgoingMessageLocally,
} from "@/cache/messageSync.util";
import { generateIdempotencyKey } from "@/services/apiClient.service";
import { uploadDocumentWithProgress } from "@/services/documentUpload.service";
import { messagesService } from "@/services/messages.service";
import { useDocumentUploadsStore } from "@/store/documentUploads.store";
import type { MessageDocument } from "@/types";

import { useConversationMessageCache } from "./conversationMessageCache.hook";

export function useOptimisticDocumentSender(conversationId: string | undefined, myUserId: string) {
  const { queryClient, updateCachedMessages, replaceCachedMessage, removeCachedMessage } = useConversationMessageCache(conversationId);

  const uploadThenDeliver = useCallback(
    async (pendingMessage: LocallyStoredMessage) => {
      const document = pendingMessage.document!;
      const markFailed = () => {
        markPendingMessageAsFailedLocally(pendingMessage.id);
        replaceCachedMessage(pendingMessage.id, { ...pendingMessage, deliveryStatus: "failed" });
      };
      let mediaId: string;
      try {
        mediaId = await uploadDocumentWithProgress(pendingMessage.id, document);
      } catch {
        markFailed();
        return;
      }
      try {
        const delivered = await messagesService.sendDocumentToConversation(pendingMessage.conversationId, document, mediaId, generateIdempotencyKey());
        replacePendingMessageWithDeliveredMessageLocally(pendingMessage.id, delivered);
        replaceCachedMessage(pendingMessage.id, { ...delivered, deliveryStatus: "sent" });
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
      } catch {
        useDocumentUploadsStore.getState().clearUpload(pendingMessage.id);
        markFailed();
      }
    },
    [queryClient, replaceCachedMessage],
  );

  const sendDocument = useCallback(
    async (document: MessageDocument) => {
      if (!conversationId) return;
      const pendingMessage: LocallyStoredMessage = {
        id: `local_${generateIdempotencyKey()}`,
        conversationId,
        senderId: myUserId,
        text: "",
        createdAt: new Date().toISOString(),
        kind: "document",
        document,
        deliveryStatus: "pending",
      };
      savePendingOutgoingMessageLocally(pendingMessage);
      updateCachedMessages((messages) => [...messages, pendingMessage]);
      await uploadThenDeliver(pendingMessage);
    },
    [conversationId, myUserId, updateCachedMessages, uploadThenDeliver],
  );

  const retryDocument = useCallback(
    async (messageId: string) => {
      const failedMessage = queryClient.getQueryData<LocallyStoredMessage[]>(["messages", conversationId])?.find((message) => message.id === messageId);
      if (!failedMessage?.document) return;
      const pendingMessage = { ...failedMessage, deliveryStatus: "pending" as const };
      replaceCachedMessage(messageId, pendingMessage);
      await uploadThenDeliver(pendingMessage);
    },
    [conversationId, queryClient, replaceCachedMessage, uploadThenDeliver],
  );

  const discardDocument = useCallback(
    (messageId: string) => {
      useDocumentUploadsStore.getState().clearUpload(messageId);
      deleteLocalMessage(messageId);
      removeCachedMessage(messageId);
    },
    [removeCachedMessage],
  );

  return { sendDocument, retryDocument, discardDocument };
}
