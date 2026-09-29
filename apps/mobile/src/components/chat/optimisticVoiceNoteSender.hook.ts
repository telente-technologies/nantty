import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { Alert } from "react-native";

import type { LocallyStoredMessage } from "@/cache/messageHistory.type";
import { markPendingMessageAsFailedLocally, replacePendingMessageWithDeliveredMessageLocally } from "@/cache/messageSync.util";
import { generateIdempotencyKey } from "@/services/apiClient.service";
import type { LocalMediaFile } from "@/services/mediaPreparation.service";
import { enqueueLocalMediaForUpload, waitForUploadedMediaId } from "@/services/mediaUploadQueue.service";
import { messagesService } from "@/services/messages.service";
import type { Message } from "@/types";

export function useOptimisticVoiceNoteSender(conversationId: string | undefined, myUserId: string) {
  const queryClient = useQueryClient();

  const updateCachedMessages = useCallback(
    (change: (messages: LocallyStoredMessage[]) => LocallyStoredMessage[]) =>
      queryClient.setQueryData<LocallyStoredMessage[]>(["messages", conversationId], (existing) => change(existing ?? [])),
    [conversationId, queryClient],
  );

  return useCallback(
    async (recordedVoiceNote: LocalMediaFile) => {
      if (!conversationId) return;
      let uploadJobId: string;
      try {
        uploadJobId = await enqueueLocalMediaForUpload(recordedVoiceNote, "voice");
      } catch (error) {
        Alert.alert("Voice note not sent", error instanceof Error ? error.message : "Please try again.");
        return;
      }
      const durationSeconds = Math.round(recordedVoiceNote.durationSeconds ?? 0);
      const pendingMessage: LocallyStoredMessage = {
        id: `local_${uploadJobId}`,
        conversationId,
        senderId: myUserId,
        text: "",
        createdAt: new Date().toISOString(),
        kind: "voice",
        media: { id: uploadJobId, type: "voice", url: recordedVoiceNote.uri, durationSeconds },
        deliveryStatus: "pending",
      };
      updateCachedMessages((messages) => [...messages, pendingMessage]);
      const replacePendingMessage = (replacement: LocallyStoredMessage) =>
        updateCachedMessages((messages) => messages.map((message) => (message.id === pendingMessage.id ? replacement : message)));
      try {
        const mediaId = await waitForUploadedMediaId(uploadJobId);
        const delivered = await messagesService.sendVoiceNoteToConversation(
          conversationId,
          { kind: "voice", mediaId, durationSeconds },
          generateIdempotencyKey(),
        );
        const deliveredWithPlayableUrl: Message = {
          ...delivered,
          media: delivered.media ? { ...delivered.media, url: delivered.media.url ?? recordedVoiceNote.uri } : pendingMessage.media,
        };
        replacePendingMessageWithDeliveredMessageLocally(pendingMessage.id, deliveredWithPlayableUrl);
        replacePendingMessage({ ...deliveredWithPlayableUrl, deliveryStatus: "sent" });
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
      } catch {
        markPendingMessageAsFailedLocally(pendingMessage.id);
        replacePendingMessage({ ...pendingMessage, deliveryStatus: "failed" });
      }
    },
    [conversationId, myUserId, queryClient, updateCachedMessages],
  );
}
