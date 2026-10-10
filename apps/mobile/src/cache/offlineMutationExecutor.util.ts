import { api } from "@/services/core/apiClient.service";
import { sendEncryptedTextMessage } from "@/services/chat/messages.service";

import { messageHistoryStore } from "./messageHistory.database";
import type { QueuedOfflineMutation } from "./offlineMutation.type";

export async function sendQueuedOfflineMutationToServer(mutation: QueuedOfflineMutation): Promise<unknown> {
  const idempotencyOptions = { idempotencyKey: mutation.idempotencyKey };
  switch (mutation.kind) {
    case "likePost":
      return api.post<void>(`/api/v1/posts/${mutation.payload.postId}/like`, undefined, idempotencyOptions);
    case "unlikePost":
      return api.delete<void>(`/api/v1/posts/${mutation.payload.postId}/like`, idempotencyOptions);
    case "followUser":
      return api.post<void>(`/api/v1/users/${mutation.payload.userId}/follow`, undefined, idempotencyOptions);
    case "unfollowUser":
      return api.delete<void>(`/api/v1/users/${mutation.payload.userId}/follow`, idempotencyOptions);
    case "sendMessage": {
      const deliveredMessage = await sendEncryptedTextMessage(
        mutation.payload.conversationId,
        { text: mutation.payload.text, linkPreview: mutation.payload.linkPreview ?? null, mentions: mutation.payload.mentions },
        mutation.idempotencyKey,
      );
      messageHistoryStore.replacePendingMessageWithDeliveredMessage(mutation.payload.localMessageId, deliveredMessage);
      return deliveredMessage;
    }
  }
}

export function handleOfflineMutationPermanentlyDropped(mutation: QueuedOfflineMutation) {
  if (mutation.kind === "sendMessage") messageHistoryStore.markPendingMessageAsFailed(mutation.payload.localMessageId);
}
