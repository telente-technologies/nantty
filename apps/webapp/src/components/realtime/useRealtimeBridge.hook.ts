"use client";

import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useEffect } from "react";

import { webappRealtime } from "@/services/realtime/webappRealtime.service";
import type { CategorizedNotification } from "@/types/commerce.type";
import { readChatEventEffect, readRealtimeNotification, upsertNotification } from "@/utils/realtimeCache.util";

const coalesceMs = 400;

export function useRealtimeBridge(viewerId: string | null): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!viewerId) return;
    const pending = new Map<string, QueryKey>();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refreshSoon = (keys: readonly QueryKey[]) => {
      keys.forEach((key) => pending.set(JSON.stringify(key), key));
      timer ??= setTimeout(() => {
        timer = null;
        const keysToRefresh = [...pending.values()];
        pending.clear();
        keysToRefresh.forEach((queryKey) => void queryClient.invalidateQueries({ queryKey }));
      }, coalesceMs);
    };
    let wasLive = webappRealtime.status() === "live";
    const stopStatus = webappRealtime.onChange(() => {
      const isLive = webappRealtime.status() === "live";
      if (isLive && !wasLive) refreshSoon([["shell"], ["conversations"], ["messages"]]);
      wasLive = isLive;
    });
    const stopEvents = webappRealtime.subscribe((event) => {
      const chat = readChatEventEffect(event);
      if (chat) {
        refreshSoon([["conversations"], ["shell", "conversations"], ...(chat.refreshesThread && chat.conversationId ? [["messages", chat.conversationId]] : [])]);
        return;
      }
      const notification = readRealtimeNotification(event);
      if (notification) {
        queryClient.setQueryData<CategorizedNotification[]>(["shell", "notifications"], (current) => upsertNotification(current, notification));
        refreshSoon([["shell", "notifications"]]);
      }
    });
    webappRealtime.setEnabled(true);
    return () => {
      stopEvents();
      stopStatus();
      webappRealtime.setEnabled(false);
      if (timer) clearTimeout(timer);
    };
  }, [viewerId, queryClient]);
}
