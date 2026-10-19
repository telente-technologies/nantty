import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import type { LocallyStoredMessage } from "@/cache/messageHistory.type";
import { markPendingMessageAsFailedLocally, replacePendingMessageWithDeliveredMessageLocally } from "@/cache/messageSync.util";
import { generateIdempotencyKey } from "@/services/core/apiClient.service";
import { uploadEncryptedAttachment } from "@/services/chatCrypto/encryptedAttachments.service";
import { validateLocalMediaBeforeUpload } from "@/services/media/mediaPreparation.service";
import { messagesService } from "@/services/chat/messages.service";
import type { Message } from "@/types";
import { showAlertWithButtons } from "@/utils/crossPlatformAlert.util";

import type { RecordedVoiceNote } from "./voiceNoteRecorder.hook";

export function useOptimisticVoiceNoteSender(conversationId: string | undefined, myUserId: string) {
  const queryClient = useQueryClient();

  const updateCachedMessages = useCallback(
    (change: (messages: LocallyStoredMessage[]) => LocallyStoredMessage[]) =>
      queryClient.setQueryData<LocallyStoredMessage[]>(["messages", conversationId], (existing) => change(existing ?? [])),
    [conversationId, queryClient],
  );

  return useCallback(
    async ({ file: recordedVoiceNote, waveform }: RecordedVoiceNote) => {
      if (!conversationId) return;
      try {
        validateLocalMediaBeforeUpload(recordedVoiceNote, "voice");
      } catch (error) {
        showAlertWithButtons("Voice note not sent", error instanceof Error ? error.message : "Please try again.", undefined, { intent: "microphone" });
        return;
      }
      const localId = generateIdempotencyKey();
      const durationSeconds = Math.round(recordedVoiceNote.durationSeconds ?? 0);
      const pendingMessage: LocallyStoredMessage = {
        id: `local_${localId}`,
        conversationId,
        senderId: myUserId,
        text: "",
        createdAt: new Date().toISOString(),
        kind: "voice",
        media: { id: localId, type: "voice", url: recordedVoiceNote.uri, durationSeconds, localWaveform: waveform },
        deliveryStatus: "pending",
      };
      updateCachedMessages((messages) => [...messages, pendingMessage]);
      const replacePendingMessage = (replacement: LocallyStoredMessage) =>
        updateCachedMessages((messages) => messages.map((message) => (message.id === pendingMessage.id ? replacement : message)));
      try {
        const { mediaId, pointer } = await uploadEncryptedAttachment(recordedVoiceNote.uri, { contentType: recordedVoiceNote.mimeType ?? "audio/mp4", durationSeconds, waveform }, "voice");
        const delivered = await messagesService.sendVoiceNoteToConversation(
          conversationId,
          { kind: "voice", mediaId, durationSeconds, attachment: pointer },
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
