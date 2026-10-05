import { useCallback } from "react";

import type { LocallyStoredMessage } from "@/cache/messageHistory.type";
import {
  markPendingMessageAsFailedLocally,
  replacePendingMessageWithDeliveredMessageLocally,
  savePendingOutgoingMessageLocally,
} from "@/cache/messageSync.util";
import { generateIdempotencyKey } from "@/services/apiClient.service";
import { startLiveLocationUpdates } from "@/services/liveLocationSharing.service";
import { messagesService } from "@/services/messages.service";
import type { Message, SharedLocation } from "@/types";
import { showAlertWithButtons } from "@/utils/crossPlatformAlert.util";

import { useConversationMessageCache } from "./conversationMessageCache.hook";

const MAXIMUM_LIVE_LOCATION_MS = 8 * 3_600_000 - 120_000;

export interface OutgoingPollDraft {
  readonly question: string;
  readonly allowMultipleAnswers: boolean;
  readonly options: readonly string[];
}

export function useOptimisticLocationAndPollSender(conversationId: string | undefined, myUserId: string) {
  const { queryClient, updateCachedMessages, replaceCachedMessage, applyServerVersionOfMessage } = useConversationMessageCache(conversationId);

  const deliverOptimistically = useCallback(
    async (draft: Partial<Message>, sendToServer: () => Promise<Message>): Promise<Message | null> => {
      if (!conversationId) return null;
      const pendingMessage: LocallyStoredMessage = {
        id: `local_${generateIdempotencyKey()}`,
        conversationId,
        senderId: myUserId,
        text: "",
        createdAt: new Date().toISOString(),
        deliveryStatus: "pending",
        ...draft,
      };
      savePendingOutgoingMessageLocally(pendingMessage);
      updateCachedMessages((messages) => [...messages, pendingMessage]);
      try {
        const delivered = await sendToServer();
        replacePendingMessageWithDeliveredMessageLocally(pendingMessage.id, delivered);
        replaceCachedMessage(pendingMessage.id, { ...delivered, deliveryStatus: "sent" });
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
        return delivered;
      } catch (error) {
        markPendingMessageAsFailedLocally(pendingMessage.id);
        replaceCachedMessage(pendingMessage.id, { ...pendingMessage, deliveryStatus: "failed" });
        showAlertWithButtons("Couldn't send", error instanceof Error ? error.message : "Please try again.");
        return null;
      }
    },
    [conversationId, myUserId, queryClient, replaceCachedMessage, updateCachedMessages],
  );

  const sendCurrentLocation = useCallback(
    (location: SharedLocation) =>
      deliverOptimistically({ kind: "location", location }, () => messagesService.sendLocationToConversation(conversationId!, "location", location, generateIdempotencyKey())),
    [conversationId, deliverOptimistically],
  );

  const startSharingLiveLocation = useCallback(
    async (location: SharedLocation, durationMinutes: number) => {
      const liveLocation = { ...location, liveUntil: new Date(Date.now() + Math.min(durationMinutes * 60_000, MAXIMUM_LIVE_LOCATION_MS)).toISOString() };
      const delivered = await deliverOptimistically({ kind: "liveLocation", location: liveLocation }, () =>
        messagesService.sendLocationToConversation(conversationId!, "liveLocation", liveLocation, generateIdempotencyKey()),
      );
      if (delivered) startLiveLocationUpdates({ messageId: delivered.id, conversationId: delivered.conversationId, liveUntil: liveLocation.liveUntil }, applyServerVersionOfMessage);
    },
    [applyServerVersionOfMessage, conversationId, deliverOptimistically],
  );

  const sendPoll = useCallback(
    (poll: OutgoingPollDraft) =>
      deliverOptimistically(
        {
          kind: "poll",
          text: poll.question,
          poll: { question: poll.question, allowMultipleAnswers: poll.allowMultipleAnswers, options: poll.options.map((text, index) => ({ id: `pending_${index}`, text, voteCount: 0, votedByMe: false })) },
        },
        () => messagesService.sendPollToConversation(conversationId!, poll, generateIdempotencyKey()),
      ),
    [conversationId, deliverOptimistically],
  );

  return { sendCurrentLocation, startSharingLiveLocation, sendPoll };
}
