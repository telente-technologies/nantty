"use client";

import { useQuery } from "@tanstack/react-query";
import { useRealtimeStatus } from "@zudomart/web-kit/src/realtime/realtimeHooks";

import { cartsService } from "@/services/carts.service";
import { messagesService } from "@/services/messages.service";
import { notificationsService } from "@/services/notifications.service";
import { webappRealtime } from "@/services/realtime/webappRealtime.service";

import type { ShellBadgeCounts } from "./shellNavigation.config";

const fallbackPollMs = 60_000;

export function useShellBadgeCounts(isSignedIn: boolean): ShellBadgeCounts {
  const pollWhileOffline = useRealtimeStatus(webappRealtime) === "live" ? false : fallbackPollMs;
  const cartQuery = useQuery({ queryKey: ["shell", "cart"], queryFn: () => cartsService.fetchMyCart(), retry: false, staleTime: 20_000, enabled: isSignedIn });
  const chatQuery = useQuery({ queryKey: ["shell", "conversations"], queryFn: () => messagesService.fetchConversationList("all"), retry: false, staleTime: 20_000, enabled: isSignedIn, refetchInterval: pollWhileOffline });
  const notificationQuery = useQuery({ queryKey: ["shell", "notifications"], queryFn: () => notificationsService.fetchMyNotifications(), retry: false, staleTime: 20_000, enabled: isSignedIn, refetchInterval: pollWhileOffline });

  return {
    cart: cartQuery.data?.items.reduce((total, item) => total + item.quantity, 0) ?? 0,
    chats: chatQuery.data?.reduce((total, conversation) => total + conversation.unread, 0) ?? 0,
    notifications: notificationQuery.data?.filter((notification) => !notification.read).length ?? 0,
  };
}
