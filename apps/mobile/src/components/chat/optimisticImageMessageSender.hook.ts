import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import type { LocallyStoredMessage } from "@/cache/messageHistory.type";
import { markPendingMessageAsFailedLocally, replacePendingMessageWithDeliveredMessageLocally } from "@/cache/messageSync.util";
import { generateIdempotencyKey } from "@/services/core/apiClient.service";
import { buildEncryptedThumbnail, uploadEncryptedAttachment } from "@/services/chatCrypto/encryptedAttachments.service";
import { type LocalMediaFile, resizeAndReencodeImageWithoutMetadata, validateLocalMediaBeforeUpload } from "@/services/media/mediaPreparation.service";
import { messagesService } from "@/services/chat/messages.service";
import type { Message } from "@/types";
import { showAlertWithButtons } from "@/utils/crossPlatformAlert.util";

export function useOptimisticImageMessageSender(conversationId: string | undefined, myUserId: string) {
  const queryClient = useQueryClient();

  const updateCachedMessages = useCallback(
    (change: (messages: LocallyStoredMessage[]) => LocallyStoredMessage[]) =>
      queryClient.setQueryData<LocallyStoredMessage[]>(["messages", conversationId], (existing) => change(existing ?? [])),
    [conversationId, queryClient],
  );

  return useCallback(
    async (photo: LocalMediaFile) => {
      if (!conversationId) return;
      try {
        validateLocalMediaBeforeUpload(photo, "chat");
      } catch (error) {
        showAlertWithButtons("Photo not sent", error instanceof Error ? error.message : "Please try again.", undefined, { intent: "media" });
        return;
      }
      const localId = generateIdempotencyKey();
      const pendingMessage: LocallyStoredMessage = {
        id: `local_${localId}`,
        conversationId,
        senderId: myUserId,
        text: "",
        createdAt: new Date().toISOString(),
        kind: "image",
        media: { id: localId, type: "image", url: photo.uri },
        deliveryStatus: "pending",
      };
      updateCachedMessages((messages) => [...messages, pendingMessage]);
      const replacePendingMessage = (replacement: LocallyStoredMessage) =>
        updateCachedMessages((messages) => messages.map((message) => (message.id === pendingMessage.id ? replacement : message)));
      try {
        const prepared = await resizeAndReencodeImageWithoutMetadata(photo);
        const thumbnail = await buildEncryptedThumbnail(prepared.uri);
        const { mediaId, pointer } = await uploadEncryptedAttachment(prepared.uri, { contentType: "image/jpeg", width: prepared.width, height: prepared.height, thumbnail }, "chat");
        const delivered = await messagesService.sendImageToConversation(conversationId, { mediaId, attachment: pointer }, generateIdempotencyKey());
        const deliveredWithLocalUrl: Message = {
          ...delivered,
          media: delivered.media ? { ...delivered.media, url: delivered.media.url ?? photo.uri } : pendingMessage.media,
        };
        replacePendingMessageWithDeliveredMessageLocally(pendingMessage.id, deliveredWithLocalUrl);
        replacePendingMessage({ ...deliveredWithLocalUrl, deliveryStatus: "sent" });
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
      } catch {
        markPendingMessageAsFailedLocally(pendingMessage.id);
        replacePendingMessage({ ...pendingMessage, deliveryStatus: "failed" });
      }
    },
    [conversationId, myUserId, queryClient, updateCachedMessages],
  );
}
