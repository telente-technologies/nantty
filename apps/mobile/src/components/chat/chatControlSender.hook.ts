import type { ChatControl } from "@zudomart/chat-crypto";
import { useCallback } from "react";

import { storeDeliveredMessage } from "@/cache/messageRealtimeCache.util";
import { generateIdempotencyKey } from "@/services/core/apiClient.service";
import { sendChatControl } from "@/services/chat/messages.service";
import { useAuthStore } from "@/store/auth.store";

import { useConversationMessageCache } from "./conversationMessageCache.hook";

export function useChatControlSender(conversationId: string | undefined) {
  const myUserId = useAuthStore((state) => state.user?.id ?? "u_me");
  const { queryClient, updateCachedMessages, removeCachedMessage } = useConversationMessageCache(conversationId);
  return useCallback(
    async (control: ChatControl): Promise<boolean> => {
      if (!conversationId) return false;
      const pendingId = `local_control_${generateIdempotencyKey()}`;
      updateCachedMessages((messages) => [
        ...messages,
        { id: pendingId, conversationId, senderId: myUserId, text: "", kind: "control", control, createdAt: new Date().toISOString(), deliveryStatus: "pending" },
      ]);
      try {
        const delivered = await sendChatControl(conversationId, control);
        removeCachedMessage(pendingId);
        storeDeliveredMessage(queryClient, { ...delivered, control });
        return true;
      } catch {
        removeCachedMessage(pendingId);
        return false;
      }
    },
    [conversationId, myUserId, queryClient, removeCachedMessage, updateCachedMessages],
  );
}
