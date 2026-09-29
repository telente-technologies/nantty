import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { applyRealtimeEventToLocalCaches } from "@/cache/messageRealtimeCache.util";
import { realtimeService } from "@/services/realtime.service";
import { useAuthStore } from "@/store/auth.store";

import { useTypingIndicatorsStore } from "./typingIndicators.store";

export function useRealtimeMessagingConnection() {
  const queryClient = useQueryClient();
  const isSignedIn = useAuthStore((state) => state.status === "signedIn");
  useEffect(() => {
    if (!isSignedIn) return;
    return realtimeService.subscribeToRealtimeEvents((event) => {
      if (event.type === "typing") {
        useTypingIndicatorsStore.getState().setUserTypingInConversation(event.conversationId, event.user, event.isTyping);
        return;
      }
      applyRealtimeEventToLocalCaches(queryClient, event);
    });
  }, [isSignedIn, queryClient]);
}
