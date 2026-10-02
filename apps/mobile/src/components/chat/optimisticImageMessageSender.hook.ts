import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import type { LocallyStoredMessage } from "@/cache/messageHistory.type";
import { markPendingMessageAsFailedLocally, replacePendingMessageWithDeliveredMessageLocally } from "@/cache/messageSync.util";
import { generateIdempotencyKey } from "@/services/apiClient.service";
import type { LocalMediaFile } from "@/services/mediaPreparation.service";
import { enqueueLocalMediaForUpload, waitForUploadedMediaId } from "@/services/mediaUploadQueue.service";
import { messagesService } from "@/services/messages.service";
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
      let uploadJobId: string;
      try {
        uploadJobId = await enqueueLocalMediaForUpload(photo, "chat");
      } catch (error) {
        showAlertWithButtons("Photo not sent", error instanceof Error ? error.message : "Please try again.");
        return;
      }
      const pendingMessage: LocallyStoredMessage = {
        id: `local_${uploadJobId}`,
        conversationId,
        senderId: myUserId,
        text: "",
        createdAt: new Date().toISOString(),
        kind: "image",
        media: { id: uploadJobId, type: "image", url: photo.uri },
        deliveryStatus: "pending",
      };
      updateCachedMessages((messages) => [...messages, pendingMessage]);
      const replacePendingMessage = (replacement: LocallyStoredMessage) =>
        updateCachedMessages((messages) => messages.map((message) => (message.id === pendingMessage.id ? replacement : message)));
      try {
        const mediaId = await waitForUploadedMediaId(uploadJobId);
        const delivered = await messagesService.sendImageToConversation(conversationId, { mediaId }, generateIdempotencyKey());
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
