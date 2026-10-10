import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { applyRealtimeEventToLocalCaches } from "@/cache/messageRealtimeCache.util";
import { chatCryptoService } from "@/services/chatCrypto/chatCrypto.service";
import { realtimeService } from "@/services/core/realtime.service";
import { useAuthStore } from "@/store/auth.store";

import { useTypingIndicatorsStore } from "./typingIndicators.store";

export function useRealtimeMessagingConnection() {
  const queryClient = useQueryClient();
  const isSignedIn = useAuthStore((state) => state.status === "signedIn");
  useEffect(() => {
    if (!isSignedIn) return;
    const registration = setTimeout(() => void chatCryptoService.ensureReady().catch(() => undefined), 1_500);
    const unsubscribe = realtimeService.subscribeToRealtimeEvents((event) => {
      if (event.type === "typing") {
        useTypingIndicatorsStore.getState().setUserTypingInConversation(event.conversationId, event.user, event.isTyping);
        return;
      }
      if (event.type !== "message.created" && event.type !== "message.updated") {
        applyRealtimeEventToLocalCaches(queryClient, event);
        return;
      }
      void chatCryptoService
        .decryptMessages([{ ...event.message, text: event.message.text ?? "" }])
        .catch(() => [{ ...event.message, text: event.message.text ?? "" }])
        .then(([message]) => applyRealtimeEventToLocalCaches(queryClient, { ...event, message: message ?? event.message }));
    });
    return () => {
      clearTimeout(registration);
      unsubscribe();
    };
  }, [isSignedIn, queryClient]);
}
